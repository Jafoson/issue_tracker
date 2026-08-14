"use server";

import { revalidatePath } from "next/cache";
import { getProjects, getUserWorkspaces } from "@/features/issues/queries";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { createInvitation, invitationUrl } from "@/lib/invitations";
import { notify } from "@/lib/notify";
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
  syncProjectTeamRoles,
} from "@/lib/project-membership";
import {
  DEFAULT_PLATFORM_ROLE_KEY,
  OWNER_ROLE_KEY,
  systemRoleId,
} from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { generateHandle, pickUserColor } from "@/lib/user-defaults";
import { uid } from "@/lib/utils/id";
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
          // Ohne diese Zeile stünde das erste Projekt jedes Workspace vom ersten
          // Tag an als verwaist in der Plattformverwaltung.
          createdById: session.userId,
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

// ─── Workspace ändern und löschen ─────────────────────────────────────────────
//
// Diese beiden geben Fehler zurück statt zu werfen: sie hängen an der
// Einstellungsseite, die den Grund anzeigen soll.

type SettingsResult = { ok: true } | { error: string };

/**
 * Name und Farbe des Workspace.
 *
 * Der Slug bleibt, wie er ist — er ist zugleich die Id des Workspace und steht
 * damit in jeder Adresse, in jedem offenen Reiter und in jeder verschickten
 * Einladung. Ihn zu ändern hieße, alles davon ins Leere laufen zu lassen; die
 * Seite zeigt ihn deshalb zum Nachlesen statt als Feld.
 */
export async function updateWorkspace(
  workspaceId: string,
  data: {
    name?: string;
    color?: string;
    desc?: string;
    /**
     * Die ganze Liste, nicht ein Diff — dieselbe Wahl wie bei Teams: der Dialog
     * zeigt sie ohnehin vollständig, und ein Diff aus Einzelaufrufen wäre
     * derselbe Vorgang in mehreren Runden. `undefined` heißt „unverändert
     * lassen", `[]` heißt „alle entfernen".
     */
    links?: { label: string; url: string }[];
  },
): Promise<SettingsResult> {
  const actorId = await currentUserId();
  if (!actorId) return { error: "You must be logged in." };
  if (!(await can(actorId, "workspace.update", { workspaceId })))
    return { error: "You are not allowed to change this workspace." };

  const name = data.name?.trim();
  if (name !== undefined && !name) return { error: "Name is required." };

  // Leere Zeilen (weder Name noch Adresse) sind kein Link, sondern eine
  // ungenutzte Reihe im Dialog — sie fallen still weg. Was übrig bleibt, muss
  // vollständig sein: ein Chip ohne Beschriftung oder ohne Ziel wäre unbedienbar.
  let links: { label: string; url: string }[] | undefined;
  if (data.links !== undefined) {
    links = data.links
      .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
      .filter((link) => link.label !== "" || link.url !== "");
    for (const link of links) {
      if (!link.label || !link.url) {
        return { error: "Every link needs a label and a URL." };
      }
      if (!/^https?:\/\//i.test(link.url)) {
        return { error: "Links must start with http:// or https://." };
      }
    }
  }

  await db.$transaction(async (tx) => {
    await tx.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.desc !== undefined ? { desc: data.desc.trim() } : {}),
      },
    });

    if (links !== undefined) {
      await tx.workspaceLink.deleteMany({ where: { workspaceId } });
      if (links.length > 0) {
        await tx.workspaceLink.createMany({
          data: links.map((link, index) => ({
            id: uid("wl"),
            workspaceId,
            label: link.label,
            url: link.url,
            position: index,
          })),
        });
      }
    }
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Löscht den Workspace mit allem, was darin liegt.
 *
 * Die Issues gehen zuerst: ihr Fremdschlüssel auf das Projekt steht auf
 * `Restrict`, die Projekte ließen sich sonst gar nicht löschen. Alles Übrige —
 * Projekte, Mitglieder, Teams, Labels, Rollen, Einladungen — kaskadiert vom
 * Workspace aus.
 */
export async function deleteWorkspace(
  workspaceId: string,
): Promise<SettingsResult> {
  const actorId = await currentUserId();
  if (!actorId) return { error: "You must be logged in." };
  if (!(await can(actorId, "workspace.delete", { workspaceId })))
    return { error: "You are not allowed to delete this workspace." };

  // Vor dem Löschen gelesen: danach gibt es nichts mehr zu benennen, und ein
  // Protokolleintrag über „irgendeinen Workspace" hilft niemandem.
  const doomed = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      name: true,
      _count: { select: { members: true, projects: true } },
    },
  });

  await db.$transaction(async (tx) => {
    await tx.issue.deleteMany({ where: { project: { workspaceId } } });
    await tx.workspace.delete({ where: { id: workspaceId } });
  });

  await recordAudit({
    action: "workspace.deleted",
    actorId,
    target: {
      type: "workspace",
      id: workspaceId,
      label: doomed?.name ?? workspaceId,
    },
    workspaceId,
    meta: {
      members: doomed?._count.members ?? 0,
      projects: doomed?._count.projects ?? 0,
    },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

// ─── Teams ────────────────────────────────────────────────────────────────────
//
// Ein Team gruppiert Menschen und Projekte — und kann seit `TeamProject.roleId`
// an einem Projekt zusätzlich eine Rolle tragen. Das Team selbst vergibt damit
// immer noch keine Rechte: was es verleiht, ist genau die Projektrolle, die es
// trägt, und die landet ganz normal in `ProjectMember`
// (`syncProjectTeamRoles`, lib/project-membership.ts). Deshalb hängt das Team
// weiterhin an eigenen Permissions (`team.*`) — nur das Verleihen einer Rolle
// braucht zusätzlich `member.role.update` im betroffenen Projekt, siehe
// `resolveTeamProjectRoles`.
//
// Mitglieder und Projekte kommen als vollständige Liste herein und werden als
// Ganzes gesetzt. Der Dialog zeigt beide Mengen ohnehin komplett; ein Diff aus
// Einzelaufrufen wäre derselbe Vorgang in mehreren Runden — mit dem Risiko,
// zwischendrin steckenzubleiben.

interface TeamProjectInput {
  projectId: string;
  /** Rollen-Key aus dem Scope PROJECT, oder `null` für reine Gruppierung ohne Rolle. */
  roleKey: string | null;
}

interface TeamInput {
  name: string;
  key: string;
  color: string;
  desc?: string;
  leadId: string;
  memberIds: string[];
  projects: TeamProjectInput[];
}

/** Kürzel wie beim Projekt: bis zu vier Zeichen, Buchstaben und Ziffern. */
function teamKey(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4);
}

/**
 * Prüft die Eingaben gegen den Workspace: Kürzel frei, Lead und Mitglieder
 * gehören dazu, Projekte auch. Ohne diese Runde ließe sich über die Ids eines
 * fremden Mandanten ein Team zusammenstellen, das ihn quer aufspannt.
 */
async function checkTeamInput(
  workspaceId: string,
  data: TeamInput,
  teamId?: string,
): Promise<{ error: string } | { key: string; memberIds: string[] }> {
  const name = data.name.trim();
  if (!name) return { error: "Name is required." };

  const key = teamKey(data.key) || teamKey(name);
  if (!key) return { error: "The identifier cannot be empty." };

  const taken = await db.team.findUnique({
    where: { workspaceId_key: { workspaceId, key } },
    select: { id: true },
  });
  if (taken && taken.id !== teamId)
    return { error: "Another team in this workspace uses that identifier." };

  // Der Lead führt das Team und muss deshalb selbst darin stehen — sonst hätte
  // die Zeile einen Verantwortlichen, der nicht dazugehört.
  const memberIds = [...new Set([data.leadId, ...data.memberIds])];

  const known = await db.workspaceMember.count({
    where: { workspaceId, userId: { in: memberIds } },
  });
  if (known !== memberIds.length)
    return { error: "Only workspace members can be part of a team." };

  const projectIds = [...new Set(data.projects.map((p) => p.projectId))];
  if (projectIds.length > 0) {
    const projects = await db.project.count({
      where: { workspaceId, id: { in: projectIds } },
    });
    if (projects !== projectIds.length)
      return { error: "Only projects of this workspace can be assigned." };
  }

  return { key, memberIds };
}

/**
 * Für jede Team-Projekt-Verknüpfung die zu vergebende Rolle auflösen — oder
 * `null` für reine Gruppierung ohne Rolle.
 *
 * Eine Rolle über ein Team zu verleihen ist ein Zugriffsentscheid wie jede
 * andere Rollenvergabe im Projekt: verlangt wird deshalb zusätzlich
 * `member.role.update` in genau diesem Projekt, und der Rang darf die eigene
 * Obergrenze dort nicht übersteigen (`assignmentCeiling`, wie in
 * `features/projects/actions.ts`). Ohne diese zweite Prüfung könnte, wer nur
 * `team.project.manage` trägt — die Workspace-Rolle „Manager" etwa, die
 * keinerlei Projektrechte hat —, über ein Team Zugriff auf beliebige Projekte
 * des Workspace verleihen, an denen er selbst gar nichts darf.
 */
async function resolveTeamProjectRoles(
  workspaceId: string,
  actorId: string,
  projects: TeamProjectInput[],
): Promise<
  | { error: string }
  | { entries: { projectId: string; roleId: string | null }[] }
> {
  const entries: { projectId: string; roleId: string | null }[] = [];

  for (const p of projects) {
    if (!p.roleKey) {
      entries.push({ projectId: p.projectId, roleId: null });
      continue;
    }

    const access = await accessFor(actorId, { projectId: p.projectId });
    if (!access.has("member.role.update"))
      return {
        error: "You are not allowed to grant project roles through teams here.",
      };

    const role = await db.role.findFirst({
      where: {
        scope: "PROJECT",
        key: p.roleKey,
        OR: [
          { system: true },
          { workspaceId, projectId: null },
          { projectId: p.projectId },
        ],
      },
      select: { id: true, rank: true },
      // Wie `resolveAssignable`: die spezifischste Rolle gewinnt, falls
      // mehrere denselben Key tragen.
      orderBy: [
        { projectId: { sort: "desc", nulls: "last" } },
        { workspaceId: { sort: "desc", nulls: "last" } },
      ],
    });
    if (!role) return { error: "Pick a valid role for each project." };
    if (role.rank > assignmentCeiling(access, "PROJECT"))
      return {
        error: "You cannot grant a team a role above your own in that project.",
      };

    entries.push({ projectId: p.projectId, roleId: role.id });
  }

  return { entries };
}

export async function createTeam(
  workspaceId: string,
  data: TeamInput,
): Promise<SettingsResult> {
  const actorId = await currentUserId();
  if (!actorId) return { error: "You must be logged in." };
  if (!(await can(actorId, "team.create", { workspaceId })))
    return { error: "You are not allowed to create teams here." };

  const checked = await checkTeamInput(workspaceId, data);
  if ("error" in checked) return checked;

  const resolved = await resolveTeamProjectRoles(
    workspaceId,
    actorId,
    data.projects,
  );
  if ("error" in resolved) return resolved;

  const teamId = uid("t");

  await db.$transaction(async (tx) => {
    await tx.team.create({
      data: {
        id: teamId,
        workspaceId,
        name: data.name.trim(),
        key: checked.key,
        color: data.color,
        desc: data.desc?.trim() ?? "",
        leadId: data.leadId,
        members: { create: checked.memberIds.map((userId) => ({ userId })) },
        projects: {
          create: resolved.entries.map((p) => ({
            projectId: p.projectId,
            roleId: p.roleId,
          })),
        },
      },
    });

    for (const p of resolved.entries) {
      if (p.roleId)
        await syncProjectTeamRoles(tx, p.projectId, checked.memberIds);
    }
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Ein Team ändern — Stammdaten, Mitglieder und Projekte in einem Zug.
 *
 * Die drei Teile hängen an drei Rechten (`team.update`, `team.member.manage`,
 * `team.project.manage`). Wer nur eines davon hat, ändert nur seinen Teil: die
 * übrigen Angaben werden übergangen statt abgelehnt, weil der Dialog sie ohnehin
 * nur anzeigt, wenn sie bedienbar sind.
 */
export async function updateTeam(
  teamId: string,
  data: TeamInput,
): Promise<SettingsResult> {
  const actorId = await currentUserId();
  if (!actorId) return { error: "You must be logged in." };

  const team = await db.team.findUnique({
    where: { id: teamId },
    select: { workspaceId: true },
  });
  if (!team) return { error: "This team no longer exists." };
  const { workspaceId } = team;

  const [canUpdate, canMembers, canProjects] = await Promise.all([
    can(actorId, "team.update", { workspaceId }),
    can(actorId, "team.member.manage", { workspaceId }),
    can(actorId, "team.project.manage", { workspaceId }),
  ]);
  if (!canUpdate && !canMembers && !canProjects)
    return { error: "You are not allowed to change this team." };

  const checked = await checkTeamInput(workspaceId, data, teamId);
  if ("error" in checked) return checked;

  // Nur auflösen, was auch geschrieben wird — ohne `team.project.manage`
  // bräuchte die Prüfung in `resolveTeamProjectRoles` sonst Rechte, die der
  // Aufruf am Ende ohnehin übergeht.
  const resolved = canProjects
    ? await resolveTeamProjectRoles(workspaceId, actorId, data.projects)
    : { entries: [] as { projectId: string; roleId: string | null }[] };
  if ("error" in resolved) return resolved;

  await db.$transaction(async (tx) => {
    // Vorher merken, wen und welche Projekte der Team-Rollen-Sync danach
    // abgleichen muss — die alten Zeilen sind nach den Änderungen unten schon
    // weg, und ohne diesen Stand verlöre jemand, der aus dem Team fliegt,
    // seine Team-Rolle nie wieder.
    const [before, previousProjectRoles] = await Promise.all([
      tx.teamMember.findMany({ where: { teamId }, select: { userId: true } }),
      tx.teamProject.findMany({
        where: { teamId, roleId: { not: null } },
        select: { projectId: true },
      }),
    ]);
    const previousMemberIds = before.map((m) => m.userId);
    const previousProjectIds = previousProjectRoles.map((p) => p.projectId);

    if (canUpdate) {
      await tx.team.update({
        where: { id: teamId },
        data: {
          name: data.name.trim(),
          key: checked.key,
          color: data.color,
          desc: data.desc?.trim() ?? "",
          leadId: data.leadId,
        },
      });
    }

    if (canMembers) {
      await tx.teamMember.deleteMany({ where: { teamId } });
      await tx.teamMember.createMany({
        data: checked.memberIds.map((userId) => ({ teamId, userId })),
      });
    }

    if (canProjects) {
      await tx.teamProject.deleteMany({ where: { teamId } });
      await tx.teamProject.createMany({
        data: resolved.entries.map((p) => ({
          teamId,
          projectId: p.projectId,
          roleId: p.roleId,
        })),
      });
    }

    // Betroffen ist, wer vorher oder nachher Mitglied war, in jedem Projekt,
    // das vorher oder nachher eine Rolle trug.
    const affectedMemberIds = canMembers
      ? [...new Set([...previousMemberIds, ...checked.memberIds])]
      : previousMemberIds;
    const currentProjectIds = canProjects
      ? resolved.entries.filter((p) => p.roleId).map((p) => p.projectId)
      : previousProjectIds;
    const affectedProjectIds = [
      ...new Set([...previousProjectIds, ...currentProjectIds]),
    ];

    for (const projectId of affectedProjectIds) {
      await syncProjectTeamRoles(tx, projectId, affectedMemberIds);
    }
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteTeam(teamId: string): Promise<SettingsResult> {
  const actorId = await currentUserId();
  if (!actorId) return { error: "You must be logged in." };

  const team = await db.team.findUnique({
    where: { id: teamId },
    select: { workspaceId: true },
  });
  if (!team) return { error: "This team no longer exists." };

  if (!(await can(actorId, "team.delete", { workspaceId: team.workspaceId })))
    return { error: "You are not allowed to delete this team." };

  await db.$transaction(async (tx) => {
    const [members, projectRoles] = await Promise.all([
      tx.teamMember.findMany({ where: { teamId }, select: { userId: true } }),
      tx.teamProject.findMany({
        where: { teamId, roleId: { not: null } },
        select: { projectId: true },
      }),
    ]);
    const memberIds = members.map((m) => m.userId);

    // Mitgliedschaften und Projektzuordnungen kaskadieren vom Team aus; an den
    // Aufgaben hängt ein Team nicht, es bleibt also nichts zurück.
    await tx.team.delete({ where: { id: teamId } });

    // Nach dem Löschen zählt diese Verknüpfung nicht mehr mit — wer seine
    // Projektrolle nur von hier hatte, verliert die Zeile jetzt (sofern nicht
    // manuell gesetzt oder von einem anderen Team weiter getragen).
    for (const { projectId } of projectRoles) {
      await syncProjectTeamRoles(tx, projectId, memberIds);
    }
  });

  revalidatePath("/", "layout");
  return { ok: true };
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
    select: { id: true, rank: true, name: true },
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

  await notify({
    userId,
    type: "role",
    actorId,
    workspaceId,
    text: next.name,
  });

  // „Wer hat wem Rechte gegeben?" — dieselbe Frage wie auf der Plattform-Ebene,
  // hier für den Workspace. Der Eintrag trägt beide Rollen, damit man später
  // sieht, in welche Richtung es ging.
  const target_ = await db.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true },
  });
  await recordAudit({
    action: "member.role.changed",
    actorId,
    target: {
      type: "user",
      id: userId,
      label: target_
        ? `${target_.firstName} ${target_.lastName}`.trim()
        : userId,
    },
    workspaceId,
    meta: { from: target.role.key, to: roleKey },
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
    select: { id: true, rank: true, name: true },
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

    // Ein neues Konto steckt noch hinter einem Einladungstoken (unten) und
    // kann sich nicht anmelden — dort gäbe es niemanden, der eine
    // In-App-Benachrichtigung sehen könnte. Wer schon ein Konto hat, ist
    // direkt Mitglied und bekommt sie sofort.
    await notify({
      userId: existing.id,
      type: "invite",
      actorId,
      workspaceId,
      text: role.name,
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
