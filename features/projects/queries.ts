import { cache } from "react";
import type {
  ProjectMemberRow,
  ProjectMembersView,
} from "@/features/projects/types";
import { db } from "@/lib/db";
import { accessFor, assignmentCeiling, currentUserId } from "@/lib/permissions";
import { DEFAULT_PROJECT_ROLE_KEY } from "@/lib/rbac";
import type { Project, Role, User } from "@/types";

export interface ProjectWithStats extends Project {
  issueCount: number;
}

export const getProjectsWithStats = cache(
  async (workspaceId: string): Promise<ProjectWithStats[]> => {
    const projects = await db.project.findMany({
      where: { workspaceId },
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
 * Zwei Quellen, wie in `lib/permissions.ts`: ein `ProjectMember`-Eintrag setzt
 * eine eigene Projektrolle, sonst gilt die Workspace-Rolle. Letztere greift nur
 * bei öffentlichen Projekten; Owner und Admins sehen ohnehin jedes Projekt und
 * lassen sich deshalb auch nicht per Projekt-Eintrag herabstufen.
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
      select: { workspaceId: true, visibility: true },
    });
    if (!project) return null;
    const { workspaceId, visibility } = project;

    const actorId = await currentUserId();

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

    const access = actorId
      ? await accessFor(actorId, { projectId })
      : await accessFor(null, { projectId });
    const canManage = access.has("member.invite");
    const canInvite = access.has("member.invite");
    const actorRank = canManage
      ? assignmentCeiling(access, "PROJECT")
      : Number.NEGATIVE_INFINITY;

    const seesEveryProject = new Set(viewAllRoles.map((r) => r.id));
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
      // schon gar nicht über diese Tabelle.
      manageable:
        canManage && pm.userId !== actorId && pm.role.rank <= actorRank,
    }));

    const hasOwnEntry = new Set(projectMembers.map((pm) => pm.userId));
    const candidates: User[] = [];

    for (const wm of workspaceMembers) {
      if (hasOwnEntry.has(wm.userId)) continue;

      const user = toUser(wm.user, wm.pending);
      // Wer ohnehin jedes Projekt sieht, braucht keinen Projekt-Eintrag — der
      // wäre nur eine leere Geste.
      const isPrivileged = seesEveryProject.has(wm.roleId);
      if (!isPrivileged) candidates.push(user);

      if (wm.pending) continue;
      if (!isPrivileged && visibility !== "public") continue;

      rows.push({
        user,
        role: wm.role.key,
        roleName: wm.role.name,
        roleRank: wm.role.rank,
        source: "workspace",
        pending: false,
        you: wm.userId === actorId,
        manageable: canManage && !isPrivileged && wm.userId !== actorId,
      });
    }

    const assignableRoles: Role[] = canManage
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
      candidates,
      assignableRoles,
      defaultRole,
      canManage,
      canInvite,
    };
  },
);
