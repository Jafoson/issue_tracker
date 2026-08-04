import { cache } from "react";
import type {
  ProjectMemberRow,
  ProjectMembersView,
  ProjectSettingsView,
} from "@/features/projects/types";
import { db } from "@/lib/db";
import {
  accessFor,
  assignmentCeiling,
  currentUserId,
  visibleProjectIds,
} from "@/lib/permissions";
import { DEFAULT_PROJECT_ROLE_KEY } from "@/lib/rbac";
import type { Project, Role, User } from "@/types";

export interface ProjectWithStats extends Project {
  issueCount: number;
}

export const getProjectsWithStats = cache(
  async (workspaceId: string): Promise<ProjectWithStats[]> => {
    // Dieselbe Sichtbarkeitsregel wie in `getProjects` — die Übersichtsseite ist
    // nur eine andere Darstellung derselben Liste.
    const visible = await visibleProjectIds(workspaceId);
    if (visible.size === 0) return [];

    const projects = await db.project.findMany({
      where: { workspaceId, id: { in: [...visible] } },
      include: { _count: { select: { issues: true } } },
      orderBy: { name: "asc" },
    });

    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      prefix: p.prefix,
      color: p.color,
      issueCount: p._count.issues,
    }));
  },
);

// ── Einstellungen ─────────────────────────────────────────────────────────────

/**
 * Das Projekt, wie seine Einstellungsseite es braucht — samt der Frage, was der
 * Handelnde damit darf.
 *
 * `null` heißt „gibt es für dich nicht": entweder existiert das Projekt nicht,
 * oder es ist nicht sichtbar. Die Seite macht daraus ein 404, und damit verrät
 * sie nicht, welcher der beiden Fälle vorliegt.
 */
export const getProjectSettingsView = cache(
  async (projectId: string): Promise<ProjectSettingsView | null> => {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        slug: true,
        prefix: true,
        color: true,
        visibility: true,
        _count: { select: { issues: true, members: true } },
      },
    });
    if (!project) return null;

    const access = await accessFor(await currentUserId(), { projectId });
    if (!access.has("project.view")) return null;

    return {
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
        prefix: project.prefix,
        color: project.color,
        visibility: project.visibility,
        issueCount: project._count.issues,
        memberCount: project._count.members,
      },
      canUpdate: access.has("project.update"),
      canDelete: access.has("project.delete"),
    };
  },
);

// ── Mitglieder ────────────────────────────────────────────────────────────────

type UserRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  color: string;
  image: string | null;
};

function toUser(u: UserRow, pending: boolean): User {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    color: u.color,
    ...(u.image ? { image: u.image } : {}),
    pending,
  };
}

const byName = [
  { user: { firstName: "asc" as const } },
  { user: { lastName: "asc" as const } },
];

/**
 * Wer Zugriff auf ein Projekt hat — und woher dieser Zugriff kommt.
 *
 * Die Liste ist `ProjectMember`: jede Zeile eine Person mit ihrer Projektrolle,
 * und die entscheidet hier (`lib/permissions.ts`). Dazu kommen nur die, die sich
 * per Projektrolle gar nicht herabstufen lassen — Owner und Admins des Workspace
 * sehen jedes Projekt, auch ohne Eintrag darin. Sie stehen mit ihrer
 * Workspace-Rolle in der Liste (`source: "workspace"`).
 *
 * Die Seite bekommt fertige Zeilen inklusive `manageable` — welche Rolle wen
 * anfassen darf, entscheidet der Server, nicht der Client.
 */
const memberRoleSelect = {
  select: { id: true, key: true, name: true, rank: true },
} as const;

export const getProjectMembersView = cache(
  async (projectId: string): Promise<ProjectMembersView | null> => {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    if (!project) return null;
    const { workspaceId } = project;

    const actorId = await currentUserId();
    const access = await accessFor(actorId, { projectId });

    // Die Liste nennt Namen und E-Mail-Adressen. Wer das Projekt nicht sehen
    // darf, bekommt dasselbe wie bei einem Projekt, das es nicht gibt — die
    // Seite macht daraus ein 404.
    if (!access.has("project.view")) return null;

    const [projectMembers, workspaceMembers, projectRoles, viewAllRoles] =
      await Promise.all([
        db.projectMember.findMany({
          where: { projectId },
          include: { user: true, role: memberRoleSelect },
          orderBy: byName,
        }),
        db.workspaceMember.findMany({
          where: { workspaceId },
          include: { user: true, role: memberRoleSelect },
          orderBy: byName,
        }),
        // Zuweisbar sind die Projektrollen des Workspace plus die
        // projektlokalen Rollen genau dieses Projekts.
        db.role.findMany({
          where: {
            scope: "PROJECT",
            OR: [
              { system: true },
              { workspaceId, projectId: null },
              { projectId },
            ],
          },
          orderBy: { rank: "desc" },
        }),
        // Welche Workspace-Rollen ihre Träger in jedes Projekt sehen lassen.
        // Ersetzt die frühere Abfrage auf die Namen "owner" und "admin".
        db.role.findMany({
          where: {
            scope: "WORKSPACE",
            OR: [{ system: true }, { workspaceId }],
            permissions: {
              some: {
                permissionKey: "project.view.all",
                effect: "ALLOW",
              },
            },
          },
          select: { id: true },
        }),
      ]);

    // Drei Rechte, drei Bedeutungen — die Oberfläche zeigt genau das, was die
    // dazugehörige Action auch durchlässt (`requireMemberManage`).
    const canAdd = access.has("member.invite");
    const canSetRole = access.has("member.role.update");
    const canRemove = access.has("member.remove");
    const anyManage = canAdd || canSetRole || canRemove;
    const actorRank = anyManage
      ? assignmentCeiling(access, "PROJECT")
      : Number.NEGATIVE_INFINITY;

    const viewAll = new Set(viewAllRoles.map((r) => r.id));
    // Wer über seine Workspace-Rolle jedes Projekt sieht, lässt sich per
    // Projektrolle nicht herabstufen (`keepsProjectRights` in lib/permissions.ts).
    const privileged = new Set(
      workspaceMembers
        .filter((m) => viewAll.has(m.roleId))
        .map((m) => m.userId),
    );
    const pendingOf = new Map(
      workspaceMembers.map((m) => [m.userId, m.pending]),
    );

    const rows: ProjectMemberRow[] = projectMembers.map((pm) => ({
      user: toUser(pm.user, pendingOf.get(pm.userId) ?? false),
      role: pm.role.key,
      roleName: pm.role.name,
      roleRank: pm.role.rank,
      source: "project",
      pending: pendingOf.get(pm.userId) ?? false,
      you: pm.userId === actorId,
      // Niemand ändert ein Mitglied, das über ihm steht — und die eigene Rolle
      // schon gar nicht über diese Tabelle. Die Leitung des Workspace bleibt
      // außen vor: an ihren Rechten würde die Änderung nichts ändern.
      //
      // Das sagt nur, dass die Zeile anfassbar ist. Welche der drei Aktionen
      // erlaubt ist, sagen `canSetRole` und `canRemove`.
      manageable:
        anyManage &&
        pm.userId !== actorId &&
        !privileged.has(pm.userId) &&
        pm.role.rank <= actorRank,
    }));

    const hasOwnEntry = new Set(projectMembers.map((pm) => pm.userId));
    const candidates: User[] = [];

    for (const wm of workspaceMembers) {
      if (hasOwnEntry.has(wm.userId)) continue;

      const user = toUser(wm.user, wm.pending);
      // Wer ohnehin jedes Projekt sieht, braucht keinen Projekt-Eintrag — der
      // wäre nur eine leere Geste.
      const isPrivileged = privileged.has(wm.userId);
      if (!isPrivileged) candidates.push(user);

      if (wm.pending) continue;
      // Ohne Projektrolle gibt es keinen Zugriff — außer für die, die jedes
      // Projekt sehen. Nur sie stehen hier ohne eigenen Eintrag in der Liste.
      if (!isPrivileged) continue;

      rows.push({
        user,
        role: wm.role.key,
        roleName: wm.role.name,
        roleRank: wm.role.rank,
        source: "workspace",
        pending: false,
        you: wm.userId === actorId,
        // Hier steht nur, wer ohnehin jedes Projekt sieht — an dieser Zeile gibt
        // es nichts zu verwalten. Ein Projekt-Eintrag würde ihre Rechte nicht
        // ändern (`keepsProjectRights`), ein Entzug erst recht nicht.
        manageable: false,
      });
    }

    const assignableRoles: Role[] =
      canSetRole || canAdd
        ? projectRoles
            .filter((r) => r.rank <= actorRank)
            .map((r) => ({
              id: r.key,
              name: r.name,
              desc: r.desc,
              rank: r.rank,
            }))
        : [];
    const defaultRole =
      assignableRoles.find((r) => r.id === DEFAULT_PROJECT_ROLE_KEY)?.id ??
      assignableRoles.at(-1)?.id ??
      "";

    return {
      rows,
      candidates: canAdd ? candidates : [],
      assignableRoles,
      defaultRole,
      canAdd,
      canSetRole,
      canRemove,
      canInvite: canAdd,
    };
  },
);
