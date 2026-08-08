// ─── Projektmitgliedschaft ────────────────────────────────────────────────────
//
// `ProjectMember` ist auf der Projekt-Ebene, was `WorkspaceMember` auf der
// Workspace-Ebene ist: die Liste, wer dabei ist, und mit welcher Rolle. Sie ist
// die Zugriffsentscheidung für alles Projektbezogene — keine Zeile heißt kein
// Zugriff (siehe `lib/permissions.ts`).
//
// Damit muss die Zeile entstehen, wo Zugehörigkeit entsteht: bei einem neuen
// Projekt für alle Mitglieder des Workspace, bei einer neuen Mitgliedschaft für
// alle öffentlichen Projekte. Wer den Workspace verlässt, verliert sie wieder.
//
// Die Rolle wird dabei aus der Workspace-Rolle abgeleitet — einmal, als
// Startwert. Danach ist sie unabhängig: sie gilt in genau diesem Projekt und
// lässt sich dort ändern, ohne dass eine Änderung am Workspace sie überschreibt.
// Genau das ist der Sinn einer eigenen Projektrolle.
//
// Private Projekte bleiben außen vor: dort ist nur, wer ausdrücklich aufgenommen
// wurde. `Project.visibility` entscheidet also nur, wer automatisch eingetragen
// wird — den Zugriff selbst regelt allein diese Tabelle.
//
// Umgekehrt heißt das auch: ein Projekt privat zu schalten nimmt niemandem etwas.
// Wer schon drin ist, bleibt drin; nur neue Workspace-Mitglieder kommen nicht mehr
// von selbst dazu. Jemanden hinauszunehmen ist eine eigene, sichtbare Handlung
// (`removeProjectMember`) — und keine Nebenwirkung eines Schalters.

import type { Prisma } from "@/lib/generated/prisma/client";
import {
  DEFAULT_PROJECT_ROLE_KEY,
  defaultProjectRoleKeyOf,
  type Permission,
  PROJECT_ADMIN_ROLE_KEY,
  PROJECT_VIEWER_ROLE_KEY,
  systemRoleId,
} from "@/lib/rbac";

/** Passt auf den Prisma-Client wie auf einen Transaktions-Client. */
type Db = Prisma.TransactionClient;

/** Ein Rollen-Eintrag, wie ihn die Datenbank liefert. */
interface Grant {
  permissionKey: string;
}

/** Key und Rollen-Einträge genügen für die Ableitung. */
const roleGrants = {
  select: {
    key: true,
    permissions: { select: { permissionKey: true } },
  },
} as const satisfies Prisma.RoleDefaultArgs;

/** So viel einer Workspace-Rolle, wie die Ableitung braucht. */
interface WorkspaceRole {
  key: string;
  permissions: readonly Grant[];
}

/**
 * Die Projektrolle, mit der jemand ins Projekt aufgenommen wird.
 *
 * Seit die Ebenen getrennt sind, sagt eine Workspace-Rolle nichts mehr darüber,
 * was ihr Träger in einem Projekt darf — über Issues und Kommentare steht dort
 * nichts. Die Zuordnung wird deshalb bei den System-Rollen ausdrücklich erklärt
 * (`defaultProjectRoleKey` in lib/rbac/roles.ts) statt aus Rechten erraten.
 *
 * Nur für selbst angelegte Workspace-Rollen bleibt eine Ableitung nötig. Sie
 * fällt bewusst nie auf `blocked`: einen Ausschluss spricht man aus, er ist kein
 * Nebenprodukt einer schwachen Rolle.
 */
export function projectRoleKeyFor(role: WorkspaceRole): string {
  const declared = defaultProjectRoleKeyOf(role.key);
  if (declared) return declared;

  const granted = new Set<string>(role.permissions.map((g) => g.permissionKey));
  const has = (permission: Permission) => granted.has(permission);

  // Greift ohnehin in jedes Projekt durch — der Eintrag ändert daran nichts.
  if (has("project.admin.all")) return PROJECT_ADMIN_ROLE_KEY;
  // Darf im Workspace etwas anlegen, arbeitet also mit.
  if (has("project.create") || has("label.create"))
    return DEFAULT_PROJECT_ROLE_KEY;
  // Sonst: mitlesen.
  return PROJECT_VIEWER_ROLE_KEY;
}

function projectRoleIdFor(role: WorkspaceRole): string {
  return systemRoleId("PROJECT", projectRoleKeyFor(role));
}

/**
 * Alle Mitglieder des Workspace in ein Projekt aufnehmen.
 *
 * Für ein frisch angelegtes Projekt gedacht, deshalb ohne Rücksicht auf
 * `visibility` — ein neues Projekt ist öffentlich. Offene Einladungen
 * (`pending`) kommen mit: die Zeile steht dann bereit, Rechte bekommt eine offene
 * Einladung dadurch keine (`lib/permissions.ts` hält sie vorher auf).
 */
export async function enrollWorkspaceMembers(
  db: Db,
  project: { id: string; workspaceId: string },
): Promise<void> {
  const members = await db.workspaceMember.findMany({
    where: { workspaceId: project.workspaceId },
    select: { userId: true, role: roleGrants },
  });
  if (members.length === 0) return;

  await db.projectMember.createMany({
    data: members.map((m) => ({
      projectId: project.id,
      userId: m.userId,
      roleId: projectRoleIdFor(m.role),
    })),
    // Wer schon eine Zeile hat, behält seine Rolle.
    skipDuplicates: true,
  });
}

/**
 * Eine einzelne Person ins Projekt aufnehmen, mit der aus ihrer Workspace-Rolle
 * abgeleiteten Projektrolle.
 *
 * Für ein privates Projekt: dort wird niemand automatisch eingetragen, der
 * Ersteller braucht seine Zeile aber trotzdem — sonst hätte er das Projekt
 * angelegt und käme nicht hinein.
 */
export async function enrollMember(
  db: Db,
  project: { id: string; workspaceId: string },
  userId: string,
): Promise<void> {
  const membership = await db.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: project.workspaceId, userId },
    },
    select: { role: roleGrants },
  });
  if (!membership) return;

  await db.projectMember.createMany({
    data: [
      {
        projectId: project.id,
        userId,
        roleId: projectRoleIdFor(membership.role),
      },
    ],
    skipDuplicates: true,
  });
}

/**
 * Ein Workspace-Mitglied in alle öffentlichen Projekte aufnehmen.
 *
 * Das Gegenstück zu `enrollWorkspaceMembers`: dort kommt ein Projekt hinzu, hier
 * eine Person.
 */
export async function enrollInWorkspaceProjects(
  db: Db,
  member: { workspaceId: string; userId: string },
): Promise<void> {
  const [membership, projects] = await Promise.all([
    db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: member.workspaceId,
          userId: member.userId,
        },
      },
      select: { role: roleGrants },
    }),
    db.project.findMany({
      where: { workspaceId: member.workspaceId, visibility: "public" },
      select: { id: true },
    }),
  ]);
  if (!membership || projects.length === 0) return;

  const roleId = projectRoleIdFor(membership.role);
  await db.projectMember.createMany({
    data: projects.map((p) => ({
      projectId: p.id,
      userId: member.userId,
      roleId,
    })),
    skipDuplicates: true,
  });
}

/**
 * Alle Projektmitgliedschaften einer Person in einem Workspace löschen.
 *
 * Für den Austritt aus dem Workspace: wer nicht mehr im Workspace ist, ist auch
 * in keinem seiner Projekte mehr. Ohne das behielte die Person über ihre
 * Projektrollen weiter Zugriff.
 */
export async function dropProjectMemberships(
  db: Db,
  member: { workspaceId: string; userId: string },
): Promise<void> {
  await db.projectMember.deleteMany({
    where: {
      userId: member.userId,
      project: { workspaceId: member.workspaceId },
    },
  });
}
