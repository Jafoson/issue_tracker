"use server";

import { revalidatePath } from "next/cache";
import {
  getProjectLabelsView,
  getProjectMembersView,
  getProjectsOverview,
  type ProjectOverviewRow,
} from "@/features/projects/queries";
import type {
  ProjectLabelRow,
  ProjectMemberRow,
  ProjectVisibility,
} from "@/features/projects/types";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { createInvitation, invitationUrl } from "@/lib/invitations";
import {
  isMailConfigured,
  sendInvitationEmail,
  sendMemberRemovedEmail,
} from "@/lib/mail";
import { notify } from "@/lib/notify";
import {
  accessFor,
  assignmentCeiling,
  can,
  currentUserId,
  hasPermission,
} from "@/lib/permissions";
import {
  enrollInWorkspaceProjects,
  enrollMember,
  enrollWorkspaceMembers,
} from "@/lib/project-membership";
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

/**
 * `inviteUrl` steht nur beim Einladen einer unbekannten Adresse da: dann entsteht
 * ein Konto ohne Passwort, und der Link ist der einzige Weg hinein. `mailSent`
 * sagt der Oberfläche, ob die Einladung zusätzlich per Mail rausging (SMTP
 * konfiguriert) — ohne das ist der Link der einzige Weg, und die Meldung muss
 * das auch so sagen.
 */
type ProjectResult =
  | { ok: true; inviteUrl?: string; mailSent?: boolean }
  | { error: string };

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
  /** Ein Satz dazu, wozu es da ist. Freiwillig — leer ist ein gültiger Wert. */
  desc?: string;
  prefix?: string;
  color: string;
  visibility?: ProjectVisibility;
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

  const visibility: ProjectVisibility =
    data.visibility === "private" ? "private" : "public";

  const desired =
    (data.prefix?.trim() || basePrefix(name))
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 4) || basePrefix(name);
  const prefix = await uniquePrefix(data.workspaceId, desired);
  const slug = await uniqueSlug(data.workspaceId, slugify(name));
  const id = uid("p");

  await db.$transaction(async (tx) => {
    await tx.project.create({
      data: {
        id,
        workspaceId: data.workspaceId,
        name,
        desc: data.desc?.trim() ?? "",
        slug,
        prefix,
        color: data.color,
        visibility,
        // Wer es angelegt hat, bleibt vermerkt. Nicht als Recht — Zugriff kommt
        // allein aus `ProjectMember` — sondern als Zuständigkeit: verschwindet
        // dieses Konto, erkennt die Plattformverwaltung das Projekt als
        // verwaist (`features/admin/queries.ts`).
        createdById: session.userId,
      },
    });

    const project = { id, workspaceId: data.workspaceId };
    // Ein öffentliches Projekt nimmt alle auf, die im Workspace sind — der
    // Eintrag hält das fest, auch für den Ersteller. In ein privates kommt nur
    // er selbst; alle weiteren werden ausdrücklich aufgenommen.
    if (visibility === "private") {
      await enrollMember(tx, project, session.userId);
    } else {
      await enrollWorkspaceMembers(tx, project);
    }
  });

  await recordAudit({
    action: "project.created",
    actorId: session.userId,
    target: { type: "project", id, label: name },
    workspaceId: data.workspaceId,
    projectId: id,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

// ─── Projekt ändern und löschen ───────────────────────────────────────────────

/** Prüft ein Projektrecht und liefert den Workspace des Projekts mit. */
async function requireProjectManage(
  projectId: string,
  permission: "project.update" | "project.delete",
): Promise<
  | {
      workspaceId: string;
      actorId: string;
      name: string;
      visibility: ProjectVisibility;
    }
  | { error: string }
> {
  const actorId = await currentUserId();
  if (!actorId) return { error: "You must be logged in." };

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true, name: true, visibility: true },
  });
  if (!project) return { error: "This project no longer exists." };

  if (!(await can(actorId, permission, { projectId }))) {
    return {
      error:
        permission === "project.delete"
          ? "You are not allowed to delete this project."
          : "You are not allowed to change this project.",
    };
  }

  return {
    workspaceId: project.workspaceId,
    actorId,
    name: project.name,
    visibility: project.visibility,
  };
}

/**
 * Name, Kürzel, Farbe und Sichtbarkeit eines Projekts.
 *
 * Der Slug bleibt, wie er ist: er steht in jeder geteilten Adresse, und ein
 * umbenanntes Projekt soll keine toten Links hinterlassen.
 *
 * Auf `public` umzuschalten nimmt alle Workspace-Mitglieder auf — das ist, was
 * öffentlich heißt. Der Weg zurück nimmt niemandem etwas: wer drin ist, bleibt
 * drin, nur neue Mitglieder kommen nicht mehr von selbst dazu. Jemanden
 * hinauszunehmen ist eine eigene Handlung (`removeProjectMember`), kein
 * Nebeneffekt eines Schalters.
 */
export async function updateProject(
  projectId: string,
  data: {
    name?: string;
    desc?: string;
    prefix?: string;
    color?: string;
    visibility?: ProjectVisibility;
  },
): Promise<ProjectResult> {
  const guard = await requireProjectManage(projectId, "project.update");
  if ("error" in guard) return guard;

  const name = data.name?.trim();
  if (name !== undefined && !name) return { error: "Name is required." };

  let prefix: string | undefined;
  if (data.prefix !== undefined) {
    prefix = data.prefix
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 4);
    if (!prefix) return { error: "The identifier cannot be empty." };

    // Beim Anlegen hängt `uniquePrefix` stillschweigend eine Ziffer an. Hier
    // wäre das falsch: wer ein Kürzel ausdrücklich eingibt, soll erfahren, dass
    // es vergeben ist, statt ein anderes zu bekommen.
    const taken = await db.project.findUnique({
      where: { workspaceId_prefix: { workspaceId: guard.workspaceId, prefix } },
      select: { id: true },
    });
    if (taken && taken.id !== projectId)
      return {
        error: "Another project in this workspace uses that identifier.",
      };
  }

  const project = await db.project.update({
    where: { id: projectId },
    data: {
      ...(name !== undefined ? { name } : {}),
      // Anders als der Name darf sie leer werden — wer sie löscht, meint das.
      ...(data.desc !== undefined ? { desc: data.desc.trim() } : {}),
      ...(prefix !== undefined ? { prefix } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
    },
    select: { id: true, workspaceId: true, name: true },
  });

  if (data.visibility === "public") {
    await enrollWorkspaceMembers(db, project);
  }

  // Eigener Vorgang statt eines allgemeinen "project.updated": nur die
  // Sichtbarkeit ist im Workspace-Aktivitäts-Feed von Belang (`whereFor` in
  // `lib/audit/index.ts`), Name/Farbe/Kürzel sind reine Projekt-Kosmetik.
  if (data.visibility !== undefined && guard.visibility !== data.visibility) {
    await recordAudit({
      action: "project.visibility.changed",
      actorId: guard.actorId,
      target: { type: "project", id: projectId, label: project.name },
      workspaceId: project.workspaceId,
      projectId,
      meta: { from: guard.visibility, to: data.visibility },
    });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Löscht ein Projekt mit allem, was daran hängt.
 *
 * Die Issues gehen zuerst: ihr Fremdschlüssel steht auf `Restrict`, das Projekt
 * ließe sich sonst gar nicht löschen. Kommentare, Projektmitglieder, Labels und
 * projektlokale Rollen kaskadieren von selbst.
 */
export async function deleteProject(projectId: string): Promise<ProjectResult> {
  const guard = await requireProjectManage(projectId, "project.delete");
  if ("error" in guard) return guard;

  // Vor dem Löschen gelesen — danach ließe sich nicht mehr sagen, was weg ist.
  const doomed = await db.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      workspaceId: true,
      _count: { select: { issues: true, members: true } },
    },
  });

  await db.$transaction(async (tx) => {
    await tx.issue.deleteMany({ where: { projectId } });
    await tx.project.delete({ where: { id: projectId } });
  });

  await recordAudit({
    action: "project.deleted",
    actorId: guard.actorId,
    target: {
      type: "project",
      id: projectId,
      label: doomed?.name ?? projectId,
    },
    workspaceId: doomed?.workspaceId ?? null,
    projectId,
    meta: {
      issues: doomed?._count.issues ?? 0,
      members: doomed?._count.members ?? 0,
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
//
// Jeder im Projekt hat eine Zeile in `ProjectMember` und damit eine Projektrolle
// (siehe `lib/project-membership.ts`). Diese Aktionen sind die Verwaltung dieser
// Rolle — sie gilt nur hier und lässt den Workspace unberührt.

interface MemberGuard {
  workspaceId: string;
  projectId: string;
  actorId: string;
  /** Höchster Projektrang, den der Handelnde vergeben darf. */
  actorRank: number;
}

/**
 * Die drei Mitglieder-Rechte sind getrennt vergebbar, also prüft jede Aktion ihr
 * eigenes: aufnehmen (`member.invite`), umrollen (`member.role.update`),
 * entfernen (`member.remove`). Ein Recht auf eines davon ist keines auf die
 * anderen — der Workspace-Pfad in `features/issues/actions.ts` hält es genauso.
 */
type MemberPermission =
  | "member.invite"
  | "member.remove"
  | "member.role.update";

async function requireMemberManage(
  projectId: string,
  permission: MemberPermission,
): Promise<MemberGuard | { error: string }> {
  const actorId = await currentUserId();
  if (!actorId) return { error: "You must be logged in." };

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });
  if (!project) return { error: "This project no longer exists." };

  const access = await accessFor(actorId, { projectId });
  if (!access.has(permission))
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
): Promise<{ id: string; rank: number; name: string } | { error: string }> {
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
    select: { id: true, rank: true, name: true },
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

/**
 * Wer den Generalschlüssel des Workspace trägt (Owner, Admin, Project Lead),
 * lässt sich per Projektrolle nicht herabstufen — der Resolver entscheidet für
 * ihn, bevor die Projektrolle überhaupt geladen wird (Regel 3 in
 * lib/permissions.ts). Die Zeile hier zu ändern hieße nur, in der Tabelle etwas
 * zu behaupten, was nicht gilt.
 */
async function notDowngradable(
  guard: MemberGuard,
  userId: string,
): Promise<boolean> {
  return can(userId, "project.admin.all", { workspaceId: guard.workspaceId });
}

/** Nimmt bestehende Workspace-Mitglieder mit einer eigenen Projektrolle auf. */
export async function addProjectMembers(data: {
  projectId: string;
  userIds: string[];
  role: string;
}): Promise<ProjectResult> {
  const guard = await requireMemberManage(data.projectId, "member.invite");
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

  // Wer schon im Projekt ist, bekäme sonst fälschlich eine "invite"-
  // Benachrichtigung für eine Aufnahme, die gar keine ist.
  const already = await db.projectMember.findMany({
    where: { projectId: data.projectId, userId: { in: userIds } },
    select: { userId: true },
  });
  const alreadyIds = new Set(already.map((m) => m.userId));
  const newlyAdded = userIds.filter((id) => !alreadyIds.has(id));

  await db.projectMember.createMany({
    data: userIds.map((userId) => ({
      projectId: data.projectId,
      userId,
      roleId: role.id,
      // Ausdrücklich von einem Projektleiter vergeben — ein Team-Sync fasst
      // diese Zeile danach nicht mehr an (`origin`, siehe schema.prisma).
      origin: "manual",
    })),
    // Wer schon eine Rolle in diesem Projekt hat, behält sie — ein Doppelklick
    // soll sie nicht überschreiben. Zum Ändern gibt es `setProjectMemberRole`.
    skipDuplicates: true,
  });

  await notify(
    newlyAdded.map((userId) => ({
      userId,
      type: "invite" as const,
      actorId: guard.actorId,
      workspaceId: guard.workspaceId,
      projectId: data.projectId,
      text: role.name,
    })),
  );

  // Erscheint dank gesetzter `workspaceId` **und** `projectId` sowohl im
  // Projekt- als auch im Workspace-Aktivitäts-Feed — genau die Frage „wer hat
  // wen in welches Projekt aufgenommen".
  const addedUsers = await db.user.findMany({
    where: { id: { in: newlyAdded } },
    select: { id: true, firstName: true, lastName: true, color: true },
  });
  for (const user of addedUsers) {
    await recordAudit({
      action: "project.member.added",
      actorId: guard.actorId,
      target: {
        type: "user",
        id: user.id,
        label: `${user.firstName} ${user.lastName}`.trim(),
      },
      personColor: user.color,
      workspaceId: guard.workspaceId,
      projectId: data.projectId,
      meta: { role: role.name },
    });
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setProjectMemberRole(
  projectId: string,
  userId: string,
  roleKey: string,
): Promise<ProjectResult> {
  const guard = await requireMemberManage(projectId, "member.role.update");
  if ("error" in guard) return guard;

  // Die eigene Rolle ändert niemand über diese Tabelle — sonst wäre der
  // Rangvergleich unten eine Prüfung gegen sich selbst.
  if (userId === guard.actorId)
    return { error: "You cannot change your own role here." };

  const role = await resolveAssignable(guard, roleKey);
  if ("error" in role) return role;

  const target = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: { select: { rank: true } } },
  });
  if (!target) return { error: "This person is not a member of the project." };
  if (target.role.rank > guard.actorRank)
    return { error: "You cannot change a member ranked above you." };
  if (await notDowngradable(guard, userId))
    return {
      error: "This member has full access to every project of the workspace.",
    };

  await db.projectMember.update({
    where: { projectId_userId: { projectId, userId } },
    // `origin: "manual"` auch dann, wenn die Zeile vorher `team` war — ein
    // Projektleiter, der hier ausdrücklich eine Rolle setzt, überschreibt die
    // Team-Zuordnung dauerhaft, nicht nur bis zum nächsten Team-Sync.
    data: { roleId: role.id, origin: "manual" },
  });

  await notify({
    userId,
    type: "role",
    actorId: guard.actorId,
    workspaceId: guard.workspaceId,
    projectId,
    text: role.name,
  });

  const changedUser = await db.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, color: true },
  });
  await recordAudit({
    action: "project.member.role.changed",
    actorId: guard.actorId,
    target: {
      type: "user",
      id: userId,
      label: changedUser
        ? `${changedUser.firstName} ${changedUser.lastName}`.trim()
        : userId,
    },
    personColor: changedUser?.color ?? null,
    workspaceId: guard.workspaceId,
    projectId,
    meta: { to: role.name },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Nimmt jemanden aus dem Projekt.
 *
 * Damit ist der Zugriff weg, nicht nur eine Sonderrolle: über das Projekt
 * entscheidet allein diese Tabelle. Die Workspace-Mitgliedschaft bleibt — wer
 * wieder mitarbeiten soll, wird neu aufgenommen. Owner und Admins des Workspace
 * lassen sich so nicht aussperren, ihre Rechte hängen nicht am Projekt-Eintrag
 * (`keepsProjectRights` in lib/permissions.ts).
 */
export async function removeProjectMember(
  projectId: string,
  userId: string,
): Promise<ProjectResult> {
  const guard = await requireMemberManage(projectId, "member.remove");
  if ("error" in guard) return guard;

  // Sich selbst nimmt man nicht heraus: das wäre der Verlust des eigenen
  // Zugriffs mit einem Klick, und ohne Weg zurück.
  if (userId === guard.actorId)
    return { error: "You cannot remove yourself from the project." };

  const target = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: {
      role: { select: { rank: true } },
      user: { select: { firstName: true, lastName: true, color: true } },
    },
  });
  if (!target) return { error: "This person is not a member of the project." };
  if (target.role.rank > guard.actorRank)
    return { error: "You cannot remove a member ranked above you." };
  if (await notDowngradable(guard, userId))
    return {
      error: "This member has full access to every project of the workspace.",
    };

  await db.projectMember.delete({
    where: { projectId_userId: { projectId, userId } },
  });

  // Kein `notify()` — die Workspace-Mitgliedschaft bleibt bestehen, aber es
  // gibt keinen `NotificationEvent` für „aus dem Projekt entfernt“, nur die Mail.
  await sendMemberRemovedEmail({
    userId,
    workspaceId: guard.workspaceId,
    projectId,
    actorId: guard.actorId,
  });

  await recordAudit({
    action: "project.member.removed",
    actorId: guard.actorId,
    target: {
      type: "user",
      id: userId,
      label: `${target.user.firstName} ${target.user.lastName}`.trim(),
    },
    personColor: target.user.color,
    workspaceId: guard.workspaceId,
    projectId,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Lädt jemanden per E-Mail ins Projekt ein.
 *
 * Existiert der Account schon, reicht `member.invite` im Projekt — es entsteht
 * nur ein Projekt-Eintrag. Für eine unbekannte Adresse muss ein Account angelegt
 * werden; das ist eine Workspace-Operation und verlangt `member.invite`
 * zusätzlich im Workspace-Kontext.
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
  const guard = await requireMemberManage(data.projectId, "member.invite");
  if ("error" in guard) return guard;

  const role = await resolveAssignable(guard, data.role);
  if ("error" in role) return role;

  const email = data.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Please enter a valid email address." };

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, firstName: true, lastName: true, color: true },
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
        origin: "manual",
      },
    });

    // Wie in `inviteWorkspaceMember`: nur wer schon ein Konto hat, kann sich
    // anmelden und eine In-App-Benachrichtigung sehen — der Neukonto-Zweig
    // unten legt nur einen Einladungslink an.
    await notify({
      userId: existing.id,
      type: "invite",
      actorId: guard.actorId,
      workspaceId: guard.workspaceId,
      projectId: data.projectId,
      text: role.name,
    });

    await recordAudit({
      action: "project.member.added",
      actorId: guard.actorId,
      target: {
        type: "user",
        id: existing.id,
        label: `${existing.firstName} ${existing.lastName}`.trim(),
      },
      personColor: existing.color,
      workspaceId: guard.workspaceId,
      projectId: data.projectId,
      meta: { role: role.name },
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
  const now = new Date();

  const { token, expiresAt } = await db.$transaction(async (tx) => {
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
      // Wer in den Workspace kommt, ist in dessen öffentlichen Projekten — nicht
      // nur in dem, aus dem die Einladung kam.
      await enrollInWorkspaceProjects(tx, {
        workspaceId: guard.workspaceId,
        userId: user.id,
      });
    }

    // Im einladenden Projekt gilt die eingeladene Rolle statt der abgeleiteten.
    // Die Zeile kann aus der Aufnahme oben schon stehen, deshalb `upsert`.
    await tx.projectMember.upsert({
      where: {
        projectId_userId: { projectId: data.projectId, userId: user.id },
      },
      update: { roleId: role.id, origin: "manual" },
      create: {
        projectId: data.projectId,
        userId: user.id,
        roleId: role.id,
        origin: "manual",
      },
    });

    // Das Konto hat kein Passwort — ohne diesen Token käme niemand hinein.
    return createInvitation(
      tx,
      {
        userId: user.id,
        workspaceId: guard.workspaceId,
        projectId: data.projectId,
      },
      now,
    );
  });

  const inviteUrl = invitationUrl(token);
  await sendInvitationEmail({
    to: email,
    workspaceId: guard.workspaceId,
    projectId: data.projectId,
    inviterId: guard.actorId,
    roleName: role.name,
    expiresAt,
    inviteUrl,
  });

  revalidatePath("/", "layout");
  return { ok: true, inviteUrl, mailSent: isMailConfigured() };
}

/** Eine weitere Seite Projekte fürs Infinite Scroll in `ProjectOverview`. */
export async function loadMoreProjectsOverview(
  workspaceId: string,
  cursor: string,
): Promise<{ items: ProjectOverviewRow[]; nextCursor: string | null }> {
  const view = await getProjectsOverview(workspaceId, cursor);
  return { items: view.rows, nextCursor: view.nextCursor };
}

/** Eine weitere Seite der eigenen Projekt-Labels fürs Infinite Scroll in
 * `ProjectLabels`. */
export async function loadMoreProjectLabels(
  projectId: string,
  cursor: string,
): Promise<{ items: ProjectLabelRow[]; nextCursor: string | null }> {
  const view = await getProjectLabelsView(projectId, cursor);
  return view
    ? { items: view.own, nextCursor: view.ownNextCursor }
    : { items: [], nextCursor: null };
}

/** Spiegelbild von `loadMoreProjectLabels`, für die geerbten Workspace-Labels. */
export async function loadMoreProjectInheritedLabels(
  projectId: string,
  cursor: string,
): Promise<{ items: ProjectLabelRow[]; nextCursor: string | null }> {
  const view = await getProjectLabelsView(projectId, undefined, cursor);
  return view
    ? { items: view.inherited, nextCursor: view.inheritedNextCursor }
    : { items: [], nextCursor: null };
}

/** Eine weitere Seite fürs Infinite Scroll in `ProjectMembers`. */
export async function loadMoreProjectMembers(
  projectId: string,
  cursor: string,
): Promise<{ items: ProjectMemberRow[]; nextCursor: string | null }> {
  const view = await getProjectMembersView(projectId, cursor);
  return view
    ? { items: view.rows, nextCursor: view.nextCursor }
    : { items: [], nextCursor: null };
}
