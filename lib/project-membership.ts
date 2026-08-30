// ─── Project membership ─────────────────────────────────────────────────────
//
// `ProjectMember` is at the project level what `WorkspaceMember` is at the
// workspace level: the list of who's in and with which role. It's the
// access decision for everything project-related — no row means no access
// (see `lib/permissions.ts`).
//
// That means the row has to come into being wherever membership comes into
// being: for a new project, for every workspace member; for a new
// membership, for every public project. Whoever leaves the workspace loses
// it again.
//
// The role is derived from the workspace role in the process — once, as a
// starting value. After that it's independent: it applies within exactly
// this project and can be changed there without a change to the workspace
// overwriting it. That's precisely the point of having a separate project
// role.
//
// Private projects stay out of this: there, only whoever was explicitly
// added is in. So `Project.visibility` only decides who gets added
// automatically — access itself is governed solely by this table.
//
// Conversely, that also means: switching a project to private doesn't take
// anything away from anyone. Whoever's already in stays in; only new
// workspace members no longer join automatically. Removing someone is its
// own, visible action (`removeProjectMember`) — not a side effect of a
// toggle.

import type { Prisma } from "@/lib/generated/prisma/client";
import {
  DEFAULT_PROJECT_ROLE_KEY,
  defaultProjectRoleKeyOf,
  type Permission,
  PROJECT_ADMIN_ROLE_KEY,
  PROJECT_VIEWER_ROLE_KEY,
  systemRoleId,
} from "@/lib/rbac";

/** Fits the Prisma client just as well as a transaction client. */
type Db = Prisma.TransactionClient;

/** A role grant row, as the database returns it. */
interface Grant {
  permissionKey: string;
}

/** Key and role grants are enough for the derivation. */
const roleGrants = {
  select: {
    key: true,
    permissions: { select: { permissionKey: true } },
  },
} as const satisfies Prisma.RoleDefaultArgs;

/** As much of a workspace role as the derivation needs. */
interface WorkspaceRole {
  key: string;
  permissions: readonly Grant[];
}

/**
 * The project role someone is added to a project with.
 *
 * Since the levels were split, a workspace role no longer says anything
 * about what its holder may do in a project — it says nothing about issues
 * and comments. The mapping is therefore stated explicitly for the system
 * roles (`defaultProjectRoleKey` in lib/rbac/roles.ts) instead of guessed
 * from permissions.
 *
 * A derivation is only still needed for custom workspace roles. It
 * deliberately never falls back to `blocked`: an exclusion is something you
 * state, not a byproduct of a weak role.
 */
export function projectRoleKeyFor(role: WorkspaceRole): string {
  const declared = defaultProjectRoleKeyOf(role.key);
  if (declared) return declared;

  const granted = new Set<string>(role.permissions.map((g) => g.permissionKey));
  const has = (permission: Permission) => granted.has(permission);

  // Reaches into every project anyway — the entry doesn't change that.
  if (has("project.admin.all")) return PROJECT_ADMIN_ROLE_KEY;
  // May create something in the workspace, so is actively working.
  if (has("project.create") || has("label.create"))
    return DEFAULT_PROJECT_ROLE_KEY;
  // Otherwise: read along.
  return PROJECT_VIEWER_ROLE_KEY;
}

function projectRoleIdFor(role: WorkspaceRole): string {
  return systemRoleId("PROJECT", projectRoleKeyFor(role));
}

/**
 * Add every workspace member to a project.
 *
 * Meant for a freshly created project, so it doesn't consider `visibility`
 * — a new project is public. Open invitations (`pending`) are included: the
 * row is then ready, but an open invitation gets no permissions from it
 * (`lib/permissions.ts` blocks it beforehand).
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
    // Whoever already has a row keeps their role.
    skipDuplicates: true,
  });
}

/**
 * Add a single person to the project, with the project role derived from
 * their workspace role.
 *
 * For a private project: nobody gets added automatically there, but the
 * creator still needs their row — otherwise they'd have created the project
 * and couldn't get into it.
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
 * Add a workspace member to every public project.
 *
 * The counterpart to `enrollWorkspaceMembers`: there a project is added,
 * here a person is.
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

// ─── Carrying team roles forward ────────────────────────────────────────────
//
// A team can carry a role on a `TeamProject` (see the schema comment
// there). That role doesn't take effect through a second resolution step in
// `lib/permissions.ts` — there it stays "exactly one role per scope,
// nothing gets merged". Instead, it writes itself here, whenever a team,
// its membership, or a project link changes, into perfectly normal
// `ProjectMember` rows. The read side notices none of this.
//
// A `ProjectMember` row with `origin: "manual"` is never touched by this
// function — neither to change it nor to delete it. That's the promise made
// to the project lead: a manually set role stays what it is, whatever a
// team changes about its links in the meantime. Whoever wants to hand it
// back to the teams resets it via the member list (which then creates a
// `manual` row again, with the team role as its starting value — a genuine
// "back to team" deliberately doesn't exist, see `resetProjectMemberToTeam`
// further below).

interface TeamRoleGrant {
  roleId: string;
  rank: number;
  teamId: string;
}

/**
 * The highest-ranked team role per person in a project.
 *
 * Several teams can be linked to the same project and contain the same
 * person — in that case the role with the higher `Role.rank` wins, exactly
 * the way `assignmentCeiling` otherwise compares ranks too. Only links with
 * a role set count; a team linked to a project purely for grouping grants
 * nothing.
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
 * Bring `ProjectMember` for a set of people in line with the current team
 * roles in a project.
 *
 * Call after any change that could affect a team role in this project:
 * team membership, a team-project link, its role, or deleting a team. The
 * function queries the current state fresh instead of taking a diff — with
 * several teams per project, "what applies now" is simpler to compute than
 * "what changed".
 *
 * Three cases per person:
 * - `origin: "manual"` → left untouched, see above.
 * - no team carries a role anymore, but the row came from a team
 *   (`origin: "team"`) → deleted. No row means no access, and without a
 *   team there's no longer a reason for one.
 * - otherwise → the row carries (newly created or updated) the
 *   highest-ranked team role, with `origin: "team"` and `originTeamId` for
 *   display.
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
 * Delete all of a person's project memberships in a workspace.
 *
 * For leaving the workspace: whoever is no longer in the workspace is no
 * longer in any of its projects either. Without this, the person would keep
 * access through their project roles.
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
