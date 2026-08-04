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

import type { Prisma } from "@/lib/generated/prisma/client";
import {
  DEFAULT_PROJECT_ROLE_KEY,
  type Permission,
  PROJECT_ADMIN_ROLE_KEY,
  PROJECT_BLOCKED_ROLE_KEY,
  PROJECT_VIEWER_ROLE_KEY,
  systemRoleId,
} from "@/lib/rbac";

/** Passt auf den Prisma-Client wie auf einen Transaktions-Client. */
type Db = Prisma.TransactionClient;

/** Ein Rollen-Eintrag, wie ihn die Datenbank liefert. */
interface Grant {
  permissionKey: string;
  effect: string;
}

/** Die Rollen-Einträge mitzulesen genügt für die Ableitung. */
const roleGrants = {
  select: { permissions: { select: { permissionKey: true, effect: true } } },
} as const;

/**
 * Die Projektrolle, mit der jemand ins Projekt aufgenommen wird.
 *
 * Als Startwert soll sie dem entsprechen, was die Workspace-Rolle im Projekt
 * hergibt — sonst dürfte durch das Eintragen plötzlich jemand mehr oder weniger.
 * Entschieden wird deshalb an den Rechten, nicht am Rollen-Key: eigene
 * Workspace-Rollen tragen beliebige Keys.
 *
 * Dieselbe Ableitung steht in der Migration
 * `20260804120000_project_membership_for_everyone`.
 */
export function projectRoleKeyFor(grants: readonly Grant[]): string {
  const allow = new Set<string>();
  const deny = new Set<string>();
  for (const g of grants) {
    if (g.effect === "DENY") deny.add(g.permissionKey);
    else allow.add(g.permissionKey);
  }
  const has = (permission: Permission) =>
    allow.has(permission) && !deny.has(permission);

  // Verwaltet Projektmitglieder oder sieht ohnehin jedes Projekt.
  if (has("member.invite") || has("project.view.all"))
    return PROJECT_ADMIN_ROLE_KEY;
  // Arbeitet mit.
  if (has("issue.create")) return DEFAULT_PROJECT_ROLE_KEY;
  // Liest mit.
  if (has("project.view")) return PROJECT_VIEWER_ROLE_KEY;
  // Durfte auch vorher kein Projekt sehen.
  return PROJECT_BLOCKED_ROLE_KEY;
}

function projectRoleIdFor(grants: readonly Grant[]): string {
  return systemRoleId("PROJECT", projectRoleKeyFor(grants));
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
      roleId: projectRoleIdFor(m.role.permissions),
    })),
    // Wer schon eine Zeile hat, behält seine Rolle.
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

  const roleId = projectRoleIdFor(membership.role.permissions);
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
