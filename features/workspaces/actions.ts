"use server";

import { revalidatePath } from "next/cache";
import { getProjects, getUserWorkspaces } from "@/features/issues/queries";
import { db } from "@/lib/db";
import { createInvitation, invitationUrl } from "@/lib/invitations";
import {
  accessFor,
  assignmentCeiling,
  can,
  currentUserId,
  PermissionError,
  requirePermission,
} from "@/lib/permissions";
import {
  dropProjectMemberships,
  enrollInWorkspaceProjects,
  enrollWorkspaceMembers,
} from "@/lib/project-membership";
import {
  DEFAULT_PLATFORM_ROLE_KEY,
  OWNER_ROLE_KEY,
  systemRoleId,
} from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { generateHandle, pickUserColor } from "@/lib/user-defaults";
import {
  DEFAULT_ISSUE_TYPES,
  DEFAULT_PRIORITIES,
  DEFAULT_STATUSES,
} from "@/lib/workspace-defaults";
import type { Project } from "@/types";

type WorkspaceResult = { redirectTo: string } | { error: string };

/**
 * Ergebnis einer Mitglieder-Aktion. `inviteUrl` steht nur da, wenn ein Konto neu
 * entstanden ist und der Link noch bei jemandem ankommen muss — es gibt keinen
 * Mailversand, also zeigt ihn die Oberfläche zum Kopieren.
 */
type MemberResult = { ok: true; inviteUrl?: string } | { error: string };

/**
 * Projekte für mehrere Workspaces auf einmal, gefiltert auf die Workspaces des
 * eingeloggten Users. Wird von der TabBar aufgerufen: jeder Tab trägt seine
 * eigene Workspace-ID in der URL, auch wenn sie vom gerade aktiven Workspace
 * abweicht — der Client fragt hier gezielt die fehlenden Workspaces nach.
 */
export async function getProjectsForWorkspaces(
  workspaceIds: string[],
): Promise<Record<string, Project[]>> {
  const session = await getSession();
  if (!session) return {};

  const memberOf = new Set(
    (await getUserWorkspaces(session.userId)).map((w) => w.id),
  );
  const allowed = [...new Set(workspaceIds)].filter((id) => memberOf.has(id));

  const entries = await Promise.all(
    allowed.map(
      async (id): Promise<[string, Project[]]> => [id, await getProjects(id)],
    ),
  );
  return Object.fromEntries(entries);
}

// Find a free workspace slug, appending 1, 2, 3… until one is available.
async function uniqueWorkspaceSlug(base: string): Promise<string> {
  const root = base || "workspace";
  let slug = root;
  let n = 0;
  while (
    await db.workspace.findUnique({ where: { slug }, select: { id: true } })
  ) {
    slug = `${root}${++n}`;
  }
  return slug;
}

// Used by the create form to show the slug that will actually be used.
export async function suggestWorkspaceSlug(base: string): Promise<string> {
  return uniqueWorkspaceSlug(base);
}

export async function createWorkspace(
  formData: FormData,
): Promise<WorkspaceResult> {
  const session = await getSession();
  if (!session) return { error: "You must be logged in." };

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const slug = (formData.get("slug") as string | null)?.trim() ?? "";
  const color = (formData.get("color") as string | null)?.trim() || "#6e63e6";

  if (!name || !slug) return { error: "Name and slug are required." };
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length > 1) {
    return {
      error: "Slug may only contain lowercase letters, numbers, and hyphens.",
    };
  }

  // Auto-dedupe: if the slug is taken, fall back to slug1, slug2, …
  const finalSlug = await uniqueWorkspaceSlug(slug);

  const projectId = crypto.randomUUID();
  const prefix =
    name
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 4) || finalSlug.toUpperCase().slice(0, 4);

  try {
    await db.$transaction(async (tx) => {
      await tx.workspace.create({
        data: { id: finalSlug, slug: finalSlug, name, color },
      });

      await tx.workspaceStatus.createMany({
        data: DEFAULT_STATUSES.map((s) => ({
          workspaceId: finalSlug,
          statusId: s.id,
        })),
      });
      await tx.workspacePriority.createMany({
        data: DEFAULT_PRIORITIES.map((p) => ({
          workspaceId: finalSlug,
          priorityId: p.id,
        })),
      });
      await tx.workspaceIssueType.createMany({
        data: DEFAULT_ISSUE_TYPES.map((t) => ({
          workspaceId: finalSlug,
          issueTypeId: t.id,
        })),
      });
      // RBAC braucht hier nichts mehr: die Default-Rollen sind geteilt und
      // liegen schon in der Datenbank. Der Ersteller wird automatisch Owner.
      await tx.workspaceMember.create({
        data: {
          workspaceId: finalSlug,
          userId: session.userId,
          roleId: systemRoleId("WORKSPACE", OWNER_ROLE_KEY),
          pending: false,
        },
      });

      const projectSlug =
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || "project";
      await tx.project.create({
        data: {
          id: projectId,
          workspaceId: finalSlug,
          name,
          slug: projectSlug,
          prefix,
          color,
        },
      });

      // Der Ersteller steht damit auch im Projekt — bisher fehlte er in
      // `ProjectMember`, weil sein Zugriff allein aus der Owner-Rolle kam.
      await enrollWorkspaceMembers(tx, {
        id: projectId,
        workspaceId: finalSlug,
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[createWorkspace]", msg);
    return { error: "Something went wrong. Please try again." };
  }

  // Locale-freier Pfad – der Client navigiert über next-intl (auto-Präfix).
  return { redirectTo: `/${finalSlug}` };
}

// ─── Mitglieder des Workspace ─────────────────────────────────────────────────
//
// Diese Aktionen lagen bisher in `features/issues/actions.ts` — dort, wo die
// Mitgliederliste zuerst gebraucht wurde. Sie gehören in die Domäne, um die es
// geht, und stehen jetzt neben dem Einladen.
//
// `setMemberRole` und `removeMember` werfen, `inviteWorkspaceMember` gibt Fehler
// zurück: die ersten beiden hängen an Zeilenaktionen einer Tabelle, die letzte an
// einem Formular, das die Ursache anzeigen soll.

export async function setMemberRole(
  workspaceId: string,
  userId: string,
  roleKey: string,
) {
  const guard = "member.role.update" as const;
  const actorId = await requirePermission(guard, { workspaceId });
  // Der Rang kommt jetzt aus der Datenbank statt aus einer Konstantenliste —
  // damit greift die Hierarchie auch für selbst angelegte Rollen.
  const actorRank = (await accessFor(actorId, { workspaceId })).rank(
    "WORKSPACE",
  );

  // Die eigene Rolle nicht über diese Tabelle — der Rangvergleich unten wäre
  // sonst eine Prüfung gegen sich selbst.
  if (userId === actorId) throw new PermissionError(guard);

  const target = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: { select: { key: true, rank: true } } },
  });
  if (!target) throw new PermissionError(guard);

  // Owner ist unveränderlich; zum Owner befördern geht nur per Ownership-Transfer.
  if (target.role.key === OWNER_ROLE_KEY || roleKey === OWNER_ROLE_KEY) {
    throw new PermissionError(guard);
  }

  // Zuweisbar sind die geteilten System-Rollen und die eigenen dieses Workspace.
  const next = await db.role.findFirst({
    where: {
      scope: "WORKSPACE",
      key: roleKey,
      OR: [{ system: true }, { workspaceId }],
    },
    select: { id: true, rank: true },
  });
  if (!next) throw new PermissionError(guard);

  // Niemand darf eine höhere Rolle vergeben oder ein höher gestelltes Mitglied ändern.
  if (next.rank > actorRank || target.role.rank > actorRank) {
    throw new PermissionError(guard);
  }

  await db.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId, userId } },
    data: { roleId: next.id },
  });
  revalidatePath("/", "layout");
}

export async function removeMember(workspaceId: string, userId: string) {
  const guard = "member.remove" as const;
  const actorId = await requirePermission(guard, { workspaceId });
  const actorRank = (await accessFor(actorId, { workspaceId })).rank(
    "WORKSPACE",
  );

  // Sich selbst hinauszuwerfen ist kein Verwaltungsvorgang — dafür gäbe es einen
  // „Workspace verlassen"-Weg, und der müsste den Owner-Fall eigens regeln.
  if (userId === actorId) throw new PermissionError(guard);

  const target = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: { select: { key: true, rank: true } } },
  });
  if (!target) throw new PermissionError(guard);

  // Der Owner kann nicht entfernt werden; höher gestellte Mitglieder ebenfalls nicht.
  if (target.role.key === OWNER_ROLE_KEY || target.role.rank > actorRank) {
    throw new PermissionError(guard);
  }

  await db.$transaction(async (tx) => {
    await tx.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    // Wer nicht mehr im Workspace ist, ist in keinem seiner Projekte mehr. Ohne
    // das behielte die Person über ihre Projektrollen weiter Zugriff.
    await dropProjectMemberships(tx, { workspaceId, userId });
  });
  revalidatePath("/", "layout");
}

/**
 * Lädt jemanden per E-Mail in den Workspace ein.
 *
 * Zwei Wege, je nachdem, ob es das Konto schon gibt:
 *
 *   bekannt    → Mitgliedschaft anlegen, fertig. Wer sich anmelden kann, braucht
 *                keine Einladung, nur einen Zugang.
 *   unbekannt  → Konto ohne Passwort, Mitgliedschaft `pending`, Einladungstoken.
 *                Erst das Annehmen macht daraus einen benutzbaren Zugang
 *                (`acceptInvitation`).
 *
 * In beiden Fällen kommt die Person in die öffentlichen Projekte des Workspace.
 * Bei einer offenen Einladung bleibt diese Zeile bis zur Annahme wirkungslos —
 * `lib/permissions.ts` gibt `pending` keine Rechte.
 */
export async function inviteWorkspaceMember(data: {
  workspaceId: string;
  email: string;
  role: string;
}): Promise<MemberResult> {
  const { workspaceId } = data;

  const actorId = await currentUserId();
  if (!actorId) return { error: "You must be logged in." };
  if (!(await can(actorId, "member.invite", { workspaceId })))
    return { error: "You are not allowed to invite people to this workspace." };

  const email = data.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Please enter a valid email address." };

  // Niemand vergibt eine Rolle über der eigenen — dieselbe Regel wie in
  // `setMemberRole`, hier nur für eine Person, die noch nicht dabei ist.
  const access = await accessFor(actorId, { workspaceId });
  const ceiling = assignmentCeiling(access, "WORKSPACE");
  if (data.role === OWNER_ROLE_KEY)
    return { error: "The owner role cannot be handed out." };

  const role = await db.role.findFirst({
    where: {
      scope: "WORKSPACE",
      key: data.role,
      OR: [{ system: true }, { workspaceId }],
    },
    select: { id: true, rank: true },
  });
  if (!role) return { error: "Pick a valid role." };
  if (role.rank > ceiling)
    return { error: "You cannot assign a role above your own." };

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    const member = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: existing.id } },
      select: { userId: true },
    });
    if (member) return { error: "This person is already in the workspace." };

    await db.$transaction(async (tx) => {
      await tx.workspaceMember.create({
        data: {
          workspaceId,
          userId: existing.id,
          roleId: role.id,
          pending: false,
        },
      });
      await enrollInWorkspaceProjects(tx, { workspaceId, userId: existing.id });
    });

    revalidatePath("/", "layout");
    return { ok: true };
  }

  // Der Name steht erst fest, wenn die Einladung angenommen wird — bis dahin
  // trägt das Konto den lokalen Teil der Adresse, damit Avatar und Liste etwas
  // Lesbares zeigen.
  const localPart = email.split("@")[0];
  const handle = await generateHandle(email);
  const now = new Date();

  const token = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        firstName: localPart.charAt(0).toUpperCase() + localPart.slice(1),
        lastName: "",
        handle,
        email,
        color: pickUserColor(),
        platformRoleId: systemRoleId("PLATFORM", DEFAULT_PLATFORM_ROLE_KEY),
      },
      select: { id: true },
    });

    await tx.workspaceMember.create({
      data: { workspaceId, userId: user.id, roleId: role.id, pending: true },
    });
    await enrollInWorkspaceProjects(tx, { workspaceId, userId: user.id });

    return createInvitation(tx, { userId: user.id, workspaceId }, now);
  });

  revalidatePath("/", "layout");
  return { ok: true, inviteUrl: invitationUrl(token) };
}
