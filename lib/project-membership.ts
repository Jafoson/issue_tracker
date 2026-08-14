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

// ─── Team-Rollen nachziehen ────────────────────────────────────────────────
//
// Ein Team kann an einem `TeamProject` eine Rolle tragen (siehe Schema-
// Kommentar dort). Diese Rolle wirkt nicht über eine zweite Auflösung in
// `lib/permissions.ts` — dort bleibt es bei „genau eine Rolle je Scope, nichts
// wird vereinigt". Stattdessen schreibt sie sich hier, beim Ändern von Team,
// Mitgliedschaft oder Projekt-Verknüpfung, in ganz normale `ProjectMember`-
// Zeilen. Die Leseseite merkt von alledem nichts.
//
// Eine `ProjectMember`-Zeile mit `origin: "manual"` fasst diese Funktion nie
// an — weder um sie zu ändern noch um sie zu löschen. Das ist die Zusage an
// den Projektleiter: eine von Hand gesetzte Rolle bleibt, was ein Team auch
// zwischendrin an seinen Verknüpfungen ändert. Wer sie wieder den Teams
// überlassen will, setzt sie über die Mitgliederliste zurück (dort entsteht
// dann wieder eine `manual`-Zeile mit der Team-Rolle als Startwert — echtes
// „zurück auf Team" gibt es bewusst nicht, siehe `resetProjectMemberToTeam`
// weiter unten).

interface TeamRoleGrant {
  roleId: string;
  rank: number;
  teamId: string;
}

/**
 * Die ranghöchste Team-Rolle je Person in einem Projekt.
 *
 * Mehrere Teams können an demselben Projekt hängen und dieselbe Person
 * enthalten — dann gewinnt die Rolle mit dem höheren `Role.rank`, genau wie
 * `assignmentCeiling` Ränge sonst auch vergleicht. Nur Verknüpfungen mit
 * gesetzter Rolle zählen; ein Team, das nur zur Gruppierung an einem Projekt
 * hängt, vergibt nichts.
 */
async function bestTeamRoleByUser(
  db: Db,
  projectId: string,
  userIds: string[],
): Promise<Map<string, TeamRoleGrant>> {
  const links = await db.teamProject.findMany({
    where: {
      projectId,
      roleId: { not: null },
      team: { members: { some: { userId: { in: userIds } } } },
    },
    select: {
      teamId: true,
      roleId: true,
      role: { select: { rank: true } },
      team: {
        select: {
          members: {
            where: { userId: { in: userIds } },
            select: { userId: true },
          },
        },
      },
    },
  });

  const best = new Map<string, TeamRoleGrant>();
  for (const link of links) {
    if (!link.roleId || !link.role) continue;
    for (const { userId } of link.team.members) {
      const current = best.get(userId);
      if (!current || link.role.rank > current.rank) {
        best.set(userId, {
          roleId: link.roleId,
          rank: link.role.rank,
          teamId: link.teamId,
        });
      }
    }
  }
  return best;
}

/**
 * `ProjectMember` für eine Reihe von Personen an die aktuellen Team-Rollen in
 * einem Projekt angleichen.
 *
 * Aufzurufen nach jeder Änderung, die eine Team-Rolle in diesem Projekt
 * betreffen könnte: Team-Mitgliedschaft, Team-Projekt-Verknüpfung, deren
 * Rolle, oder das Löschen eines Teams. Die Funktion fragt den aktuellen Stand
 * frisch ab, statt einen Diff entgegenzunehmen — bei mehreren Teams pro
 * Projekt ist „was gilt jetzt" einfacher zu bilden als „was hat sich
 * geändert".
 *
 * Drei Fälle je Person:
 * - `origin: "manual"` → unangetastet, siehe oben.
 * - kein Team trägt mehr eine Rolle, aber die Zeile stammt aus einem Team
 *   (`origin: "team"`) → gelöscht. Keine Zeile heißt kein Zugriff, und ohne
 *   Team gibt es dafür keinen Grund mehr.
 * - sonst → die Zeile trägt (neu oder aktualisiert) die ranghöchste
 *   Team-Rolle, mit `origin: "team"` und `originTeamId` zur Anzeige.
 */
export async function syncProjectTeamRoles(
  db: Db,
  projectId: string,
  userIds: string[],
): Promise<void> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;

  const [existing, bestByUser] = await Promise.all([
    db.projectMember.findMany({
      where: { projectId, userId: { in: ids } },
      select: { userId: true, origin: true },
    }),
    bestTeamRoleByUser(db, projectId, ids),
  ]);
  const originByUser = new Map(existing.map((m) => [m.userId, m.origin]));

  const toRemove: string[] = [];
  for (const userId of ids) {
    const origin = originByUser.get(userId);
    if (origin === "manual") continue;

    const grant = bestByUser.get(userId);
    if (grant) {
      await db.projectMember.upsert({
        where: { projectId_userId: { projectId, userId } },
        update: {
          roleId: grant.roleId,
          origin: "team",
          originTeamId: grant.teamId,
        },
        create: {
          projectId,
          userId,
          roleId: grant.roleId,
          origin: "team",
          originTeamId: grant.teamId,
        },
      });
    } else if (origin === "team") {
      toRemove.push(userId);
    }
  }

  if (toRemove.length > 0) {
    await db.projectMember.deleteMany({
      where: { projectId, userId: { in: toRemove } },
    });
  }
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
