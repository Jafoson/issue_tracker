"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  accessFor,
  assignmentCeiling,
  can,
  currentUserId,
  hasPermission,
} from "@/lib/permissions";
import {
  DEFAULT_PLATFORM_ROLE_KEY,
  DEFAULT_WORKSPACE_ROLE_KEY,
  PROJECT_GUEST_ROLE_KEY,
  systemRoleId,
} from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { slugify } from "@/lib/slug";
import { generateHandle, pickUserColor } from "@/lib/user-defaults";
import { uid } from "@/lib/utils/id";

type ProjectResult = { ok: true } | { error: string };

function basePrefix(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 4) || "PROJ"
  );
}

async function uniquePrefix(
  workspaceId: string,
  base: string,
): Promise<string> {
  let prefix = base;
  let n = 0;
  while (
    await db.project.findUnique({
      where: { workspaceId_prefix: { workspaceId, prefix } },
      select: { id: true },
    })
  ) {
    const suffix = String(++n);
    prefix = `${base.slice(0, 4 - suffix.length)}${suffix}`;
  }
  return prefix;
}

async function uniqueSlug(workspaceId: string, base: string): Promise<string> {
  let slug = base || "project";
  let n = 0;
  while (
    await db.project.findUnique({
      where: { workspaceId_slug: { workspaceId, slug } },
      select: { id: true },
    })
  ) {
    slug = `${base}-${++n}`;
  }
  return slug;
}

export async function createProject(data: {
  workspaceId: string;
  name: string;
  prefix?: string;
  color: string;
}): Promise<ProjectResult> {
  const session = await getSession();
  if (!session) return { error: "You must be logged in." };

  const name = data.name.trim();
  if (!name) return { error: "Name is required." };

  const allowed = await hasPermission("project.create", {
    workspaceId: data.workspaceId,
  });
  if (!allowed)
    return { error: "You are not allowed to create projects here." };

  const desired =
    (data.prefix?.trim() || basePrefix(name))
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 4) || basePrefix(name);
  const prefix = await uniquePrefix(data.workspaceId, desired);
  const slug = await uniqueSlug(data.workspaceId, slugify(name));

  await db.project.create({
    data: {
      id: uid("p"),
      workspaceId: data.workspaceId,
      name,
      slug,
      prefix,
      color: data.color,
    },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

// ─── Projektmitglieder ────────────────────────────────────────────────────────
//
// Diese Aktionen geben Fehler zurück statt zu werfen: sie hängen an Formularen
// und Tabellenzeilen, die die Ursache direkt anzeigen sollen. Die Prüfungen
// spiegeln `setMemberRole` auf Workspace-Ebene — niemand vergibt eine Rolle
// über der eigenen und niemand fasst ein höher gestelltes Mitglied an.

interface MemberGuard {
  workspaceId: string;
  projectId: string;
  actorId: string;
  /** Höchster Projektrang, den der Handelnde vergeben darf. */
  actorRank: number;
}

async function requireMemberManage(
  projectId: string,
): Promise<MemberGuard | { error: string }> {
  const actorId = await currentUserId();
  if (!actorId) return { error: "You must be logged in." };

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });
  if (!project) return { error: "This project no longer exists." };

  const access = await accessFor(actorId, { projectId });
  if (!access.has("member.invite"))
    return { error: "You are not allowed to manage members of this project." };

  return {
    workspaceId: project.workspaceId,
    projectId,
    actorId,
    actorRank: assignmentCeiling(access, "PROJECT"),
  };
}

/**
 * Die Rolle auflösen, die in diesem Projekt vergeben werden soll.
 *
 * Zuweisbar sind die Projektrollen des Workspace (gelten in allen seinen
 * Projekten) und die projektlokalen Rollen genau dieses Projekts. Über dem
 * eigenen Rang vergibt niemand etwas.
 */
async function resolveAssignable(
  guard: MemberGuard,
  roleKey: string,
): Promise<{ id: string; rank: number } | { error: string }> {
  if (!roleKey) return { error: "Pick a valid role." };

  const role = await db.role.findFirst({
    where: {
      scope: "PROJECT",
      key: roleKey,
      OR: [
        { system: true },
        { workspaceId: guard.workspaceId, projectId: null },
        { projectId: guard.projectId },
      ],
    },
    select: { id: true, rank: true },
    // Die spezifischste Rolle gewinnt, falls mehrere denselben Key tragen:
    // projektlokal vor workspaceweit vor geteilt. `nulls: "last"` ist nötig,
    // weil Postgres bei DESC sonst NULL voranstellt.
    orderBy: [
      { projectId: { sort: "desc", nulls: "last" } },
      { workspaceId: { sort: "desc", nulls: "last" } },
    ],
  });
  if (!role) return { error: "Pick a valid role." };
  if (role.rank > guard.actorRank)
    return { error: "You cannot assign a role above your own." };

  return role;
}

/** Nimmt bestehende Workspace-Mitglieder mit einer eigenen Projektrolle auf. */
export async function addProjectMembers(data: {
  projectId: string;
  userIds: string[];
  role: string;
}): Promise<ProjectResult> {
  const guard = await requireMemberManage(data.projectId);
  if ("error" in guard) return guard;

  const role = await resolveAssignable(guard, data.role);
  if ("error" in role) return role;

  const userIds = [...new Set(data.userIds)];
  if (userIds.length === 0) return { error: "Pick at least one member." };

  // Nur wer schon im Workspace ist, lässt sich direkt übernehmen. Alle anderen
  // gehen über `inviteProjectMember` — dort entsteht auch der Account.
  const members = await db.workspaceMember.findMany({
    where: { workspaceId: guard.workspaceId, userId: { in: userIds } },
    select: { userId: true },
  });
  if (members.length !== userIds.length)
    return { error: "Some of those people are not in this workspace." };

  await db.projectMember.createMany({
    data: userIds.map((userId) => ({
      projectId: data.projectId,
      userId,
      roleId: role.id,
    })),
    // Wer schon einen Eintrag hat, behält ihn — ein Doppelklick soll keine
    // bestehende Rolle überschreiben.
    skipDuplicates: true,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setProjectMemberRole(
  projectId: string,
  userId: string,
  roleKey: string,
): Promise<ProjectResult> {
  const guard = await requireMemberManage(projectId);
  if ("error" in guard) return guard;

  const role = await resolveAssignable(guard, roleKey);
  if ("error" in role) return role;

  const target = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: { select: { rank: true } } },
  });
  if (!target) return { error: "This person is not a member of the project." };
  if (target.role.rank > guard.actorRank)
    return { error: "You cannot change a member ranked above you." };

  await db.projectMember.update({
    where: { projectId_userId: { projectId, userId } },
    data: { roleId: role.id },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Entfernt die Projektrolle. Bei öffentlichen Projekten bleibt der geerbte
 * Workspace-Zugriff bestehen — entzogen wird nur die Sonderrolle.
 */
export async function removeProjectMember(
  projectId: string,
  userId: string,
): Promise<ProjectResult> {
  const guard = await requireMemberManage(projectId);
  if ("error" in guard) return guard;

  const target = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: { select: { rank: true } } },
  });
  if (!target) return { error: "This person is not a member of the project." };
  if (target.role.rank > guard.actorRank)
    return { error: "You cannot remove a member ranked above you." };

  await db.projectMember.delete({
    where: { projectId_userId: { projectId, userId } },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Lädt jemanden per E-Mail ins Projekt ein.
 *
 * Existiert der Account schon, reicht `project.member.manage` — es entsteht nur
 * ein Projekt-Eintrag. Für eine unbekannte Adresse muss ein Account angelegt
 * werden; das ist eine Workspace-Operation und verlangt zusätzlich
 * `workspace.member.invite`.
 *
 * Die Projektrolle entscheidet über die Workspace-Mitgliedschaft: ein Gast
 * bleibt bewusst außen vor und sieht nur dieses eine Projekt, jede andere Rolle
 * bekommt eine offene (`pending`) Workspace-Mitgliedschaft in der Standardrolle
 * dazu. Projekt- und Workspace-Rollen sind seit dem dreistufigen RBAC zwei
 * getrennte Töpfe — der Projektrollen-Key taugt hier also nicht als Workspace-Rolle.
 */
export async function inviteProjectMember(data: {
  projectId: string;
  email: string;
  role: string;
}): Promise<ProjectResult> {
  const guard = await requireMemberManage(data.projectId);
  if ("error" in guard) return guard;

  const role = await resolveAssignable(guard, data.role);
  if ("error" in role) return role;

  const email = data.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Please enter a valid email address." };

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    const member = await db.projectMember.findUnique({
      where: {
        projectId_userId: { projectId: data.projectId, userId: existing.id },
      },
      select: { userId: true },
    });
    if (member) return { error: "This person is already in the project." };

    await db.projectMember.create({
      data: {
        projectId: data.projectId,
        userId: existing.id,
        roleId: role.id,
      },
    });

    revalidatePath("/", "layout");
    return { ok: true };
  }

  if (
    !(await can(guard.actorId, "member.invite", {
      workspaceId: guard.workspaceId,
    }))
  ) {
    return {
      error: "You are not allowed to invite new people to this workspace.",
    };
  }

  // Der Name steht erst fest, wenn die Einladung angenommen wird — bis dahin
  // trägt der Account den lokalen Teil der Adresse, damit Avatar und Liste
  // etwas Lesbares zeigen.
  const localPart = email.split("@")[0];
  const handle = await generateHandle(email);

  await db.$transaction(async (tx) => {
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

    if (data.role !== PROJECT_GUEST_ROLE_KEY) {
      await tx.workspaceMember.create({
        data: {
          workspaceId: guard.workspaceId,
          userId: user.id,
          roleId: systemRoleId("WORKSPACE", DEFAULT_WORKSPACE_ROLE_KEY),
          pending: true,
        },
      });
    }

    await tx.projectMember.create({
      data: { projectId: data.projectId, userId: user.id, roleId: role.id },
    });
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
