"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  can,
  currentUserId,
  effectiveRoleKey,
  hasPermission,
} from "@/lib/permissions";
import { roleRank } from "@/lib/rbac";
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

  const allowed = await hasPermission("workspace.project.create", {
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
  actorId: string;
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

  if (!(await can(actorId, "project.member.manage", { projectId })))
    return { error: "You are not allowed to manage members of this project." };

  const actorRole = await effectiveRoleKey(actorId, { projectId });
  if (!actorRole)
    return { error: "You are not allowed to manage members of this project." };

  return {
    workspaceId: project.workspaceId,
    actorId,
    actorRank: roleRank(actorRole),
  };
}

/**
 * Die Rolle muss in diesem Workspace existieren und darf nicht über dem eigenen
 * Rang liegen. "owner" ist eine Workspace-Rolle und als Projektrolle sinnlos —
 * Owner haben ohnehin überall Zugriff.
 */
async function checkAssignable(
  workspaceId: string,
  role: string,
  actorRank: number,
): Promise<string | null> {
  if (!role || role === "owner") return "Pick a valid role.";
  if (roleRank(role) > actorRank)
    return "You cannot assign a role above your own.";

  const exists = await db.role.findUnique({
    where: { workspaceId_key: { workspaceId, key: role } },
    select: { key: true },
  });
  return exists ? null : "Pick a valid role.";
}

/** Nimmt bestehende Workspace-Mitglieder mit einer eigenen Projektrolle auf. */
export async function addProjectMembers(data: {
  projectId: string;
  userIds: string[];
  role: string;
}): Promise<ProjectResult> {
  const guard = await requireMemberManage(data.projectId);
  if ("error" in guard) return guard;

  const roleError = await checkAssignable(
    guard.workspaceId,
    data.role,
    guard.actorRank,
  );
  if (roleError) return { error: roleError };

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
      role: data.role,
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
  role: string,
): Promise<ProjectResult> {
  const guard = await requireMemberManage(projectId);
  if ("error" in guard) return guard;

  const roleError = await checkAssignable(
    guard.workspaceId,
    role,
    guard.actorRank,
  );
  if (roleError) return { error: roleError };

  const target = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true },
  });
  if (!target) return { error: "This person is not a member of the project." };
  if (roleRank(target.role) > guard.actorRank)
    return { error: "You cannot change a member ranked above you." };

  await db.projectMember.update({
    where: { projectId_userId: { projectId, userId } },
    data: { role },
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
    select: { role: true },
  });
  if (!target) return { error: "This person is not a member of the project." };
  if (roleRank(target.role) > guard.actorRank)
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
 * Die Rolle entscheidet über die Workspace-Mitgliedschaft: "guest" bleibt laut
 * RBAC bewusst außen vor und sieht nur dieses eine Projekt, jede andere Rolle
 * bekommt eine offene (`pending`) Workspace-Mitgliedschaft dazu.
 */
export async function inviteProjectMember(data: {
  projectId: string;
  email: string;
  role: string;
}): Promise<ProjectResult> {
  const guard = await requireMemberManage(data.projectId);
  if ("error" in guard) return guard;

  const roleError = await checkAssignable(
    guard.workspaceId,
    data.role,
    guard.actorRank,
  );
  if (roleError) return { error: roleError };

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
      data: { projectId: data.projectId, userId: existing.id, role: data.role },
    });

    revalidatePath("/", "layout");
    return { ok: true };
  }

  if (
    !(await can(guard.actorId, "workspace.member.invite", {
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
      },
      select: { id: true },
    });

    if (data.role !== "guest") {
      await tx.workspaceMember.create({
        data: {
          workspaceId: guard.workspaceId,
          userId: user.id,
          role: data.role,
          pending: true,
        },
      });
    }

    await tx.projectMember.create({
      data: { projectId: data.projectId, userId: user.id, role: data.role },
    });
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
