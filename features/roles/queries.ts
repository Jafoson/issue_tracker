import "server-only";
import { cache } from "react";
import { canGrantIn, rolesInTarget, targetGuard } from "@/features/roles/scope";
import type {
  RoleManagerView,
  RoleTarget,
  RoleView,
} from "@/features/roles/types";
import { db } from "@/lib/db";
import { accessFor, assignmentCeiling, currentUserId } from "@/lib/permissions";
import { permissionDesc, permissionsFor } from "@/lib/rbac";

/**
 * Everything a role editor needs — the pool's roles, their entries, the
 * permissions possible in this scope, and the actor's limits.
 *
 * What someone is allowed to do is decided by the server: `manageable`,
 * `grantable`, and `maxRank` come out ready-made, so the UI doesn't need to
 * reimplement rank rules (and therefore can't get them wrong either).
 */
export const getRoleManagerView = cache(
  async (target: RoleTarget): Promise<RoleManagerView> => {
    const guard = targetGuard(target);
    const actorId = await currentUserId();
    const access = await accessFor(actorId, guard.ctx);
    const canManage = access.has(guard.permission);

    const rows = await db.role.findMany({
      where: rolesInTarget(target),
      orderBy: [{ system: "desc" }, { rank: "desc" }, { name: "asc" }],
      include: {
        permissions: { select: { permissionKey: true } },
        _count: {
          select: {
            workspaceMembers: true,
            projectMembers: true,
            platformUsers: true,
          },
        },
      },
    });

    // On the platform, the pool is the platform — the global counter is
    // already the right slice there.
    const here =
      target.scope === "PLATFORM" ? null : await carriersInTarget(target);

    const maxRank = canManage
      ? assignmentCeiling(access, target.scope)
      : Number.NEGATIVE_INFINITY;

    const roles: RoleView[] = rows.map((r) => {
      const grants = r.permissions.map((g) => g.permissionKey);

      return {
        id: r.id,
        key: r.key,
        name: r.name,
        desc: r.desc,
        rank: r.rank,
        system: r.system,
        local: r.projectId !== null,
        grants,
        // System roles are the same row for every tenant and are therefore
        // locked. Nobody reaches above their own rank anyway.
        manageable: canManage && r.editable && r.rank <= maxRank,
        memberCount: here ? (here.get(r.id) ?? 0) : r._count.platformUsers,
        totalCarriers:
          r._count.workspaceMembers +
          r._count.projectMembers +
          r._count.platformUsers,
      };
    });

    const permissions = permissionsFor(target.scope).map((key) => ({
      key,
      desc: permissionDesc(key),
    }));

    return {
      target,
      roles,
      permissions,
      canManage,
      // Only pass on what you have yourself. Otherwise any role management
      // would be a path to self-promotion.
      grantable: canManage
        ? permissionsFor(target.scope).filter((p) =>
            canGrantIn(access, target, p),
          )
        : [],
      maxRank,
    };
  },
);

/**
 * How many people carry each role **in this pool**, `roleId` → count.
 *
 * The counter from `_count` can't do this: it counts a relation wholesale or
 * not at all, and the same role appears in multiple projects. A shared
 * default role would then come out at the sum across every tenant — a
 * number that means nothing to anyone on a single project's page.
 *
 * Hence a dedicated query over the pool's membership table. It counts in
 * the database instead of loading rows: this is about the quantity, not the
 * names.
 */
async function carriersInTarget(
  target: Exclude<RoleTarget, { scope: "PLATFORM" }>,
): Promise<Map<string, number>> {
  const groups =
    target.scope === "WORKSPACE"
      ? await db.workspaceMember.groupBy({
          by: ["roleId"],
          where: { workspaceId: target.workspaceId },
          _count: { _all: true },
        })
      : await db.projectMember.groupBy({
          by: ["roleId"],
          // A project's pool counts only its own members. The workspace's
          // project roles, on the other hand, apply in all of its
          // projects — there every one of them counts.
          where: target.projectId
            ? { projectId: target.projectId }
            : { project: { workspaceId: target.workspaceId } },
          _count: { _all: true },
        });

  return new Map(groups.map((g) => [g.roleId, g._count._all]));
}
