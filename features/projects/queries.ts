import { cache } from "react";
import { getRoles } from "@/features/issues/queries";
import type {
  ProjectMemberRow,
  ProjectMembersView,
} from "@/features/projects/types";
import { db } from "@/lib/db";
import { can, currentUserId, effectiveRoleKey } from "@/lib/permissions";
import { roleRank } from "@/lib/rbac";
import type { Project, User } from "@/types";

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
export const getProjectMembersView = cache(
  async (projectId: string): Promise<ProjectMembersView | null> => {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true, visibility: true },
    });
    if (!project) return null;
    const { workspaceId, visibility } = project;

    const actorId = await currentUserId();

    const [projectMembers, workspaceMembers, roles] = await Promise.all([
      db.projectMember.findMany({
        where: { projectId },
        include: { user: true },
        orderBy: byName,
      }),
      db.workspaceMember.findMany({
        where: { workspaceId },
        include: { user: true },
        orderBy: byName,
      }),
      getRoles(workspaceId),
    ]);

    const canManage = actorId
      ? await can(actorId, "project.member.manage", { projectId })
      : false;
    const canInvite = actorId
      ? await can(actorId, "workspace.member.invite", { workspaceId })
      : false;
    // Ohne Verwaltungsrecht ist der Rang belanglos — dann ist ohnehin nichts
    // bedienbar, und die Abfrage entfällt.
    const actorRank =
      canManage && actorId
        ? roleRank((await effectiveRoleKey(actorId, { projectId })) ?? "")
        : -1;

    const roleName = (key: string) =>
      roles.find((r) => r.id === key)?.name ?? key;
    const pendingOf = new Map(
      workspaceMembers.map((m) => [m.userId, m.pending]),
    );

    const rows: ProjectMemberRow[] = projectMembers.map((pm) => ({
      user: toUser(pm.user, pendingOf.get(pm.userId) ?? false),
      role: pm.role,
      roleName: roleName(pm.role),
      source: "project",
      pending: pendingOf.get(pm.userId) ?? false,
      you: pm.userId === actorId,
      // Niemand ändert ein Mitglied, das über ihm steht — und die eigene Rolle
      // schon gar nicht über diese Tabelle.
      manageable:
        canManage && pm.userId !== actorId && roleRank(pm.role) <= actorRank,
    }));

    const hasOwnEntry = new Set(projectMembers.map((pm) => pm.userId));
    const candidates: User[] = [];

    for (const wm of workspaceMembers) {
      if (hasOwnEntry.has(wm.userId)) continue;

      const user = toUser(wm.user, wm.pending);
      // Owner und Admins kommen implizit überall rein; ein Projekt-Eintrag
      // würde daran nichts ändern und wäre nur eine leere Geste.
      const isPrivileged = wm.role === "owner" || wm.role === "admin";
      if (!isPrivileged) candidates.push(user);

      if (wm.pending) continue;
      if (!isPrivileged && visibility !== "public") continue;

      rows.push({
        user,
        role: wm.role,
        roleName: roleName(wm.role),
        source: "workspace",
        pending: false,
        you: wm.userId === actorId,
        manageable: canManage && !isPrivileged && wm.userId !== actorId,
      });
    }

    const assignableRoles = canManage
      ? roles.filter((r) => r.id !== "owner" && roleRank(r.id) <= actorRank)
      : [];
    const defaultRole =
      assignableRoles.find((r) => r.id === "member")?.id ??
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
