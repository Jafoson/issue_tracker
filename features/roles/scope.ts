import "server-only";
import type { RoleTarget } from "@/features/roles/types";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  type Access,
  type Permission,
  type PermissionContext,
  PLATFORM,
} from "@/lib/permissions";
import {
  platformRoleId,
  projectRoleId,
  workspaceProjectRoleId,
  workspaceRoleId,
} from "@/lib/rbac";

// A role pool answers three questions that always belong together: which
// roles count toward it, who's allowed to manage them, and in what context
// the actor's own rights are measured. Keeping them bundled here prevents an
// action from picking up one pool's roles but another pool's check.

/**
 * All the roles that apply in this pool — the shared system roles of the
 * scope plus the workspace's or project's own.
 *
 * The system roles have no owner and therefore belong to every pool of
 * their scope. This is exactly what replaces the former per-workspace copies.
 */
export function rolesInTarget(target: RoleTarget): Prisma.RoleWhereInput {
  if (target.scope === "PLATFORM") {
    return { scope: "PLATFORM" };
  }
  if (target.scope === "WORKSPACE") {
    return {
      scope: "WORKSPACE",
      OR: [{ system: true }, { workspaceId: target.workspaceId }],
    };
  }
  // In a project, the workspace's project roles are also assignable; the
  // project-local ones are added only for a specific project.
  return {
    scope: "PROJECT",
    OR: [
      { system: true },
      { workspaceId: target.workspaceId, projectId: null },
      ...(target.projectId ? [{ projectId: target.projectId }] : []),
    ],
  };
}

/** The owner columns a new role in this pool gets. */
export function ownerColumns(target: RoleTarget): {
  workspaceId: string | null;
  projectId: string | null;
} {
  if (target.scope === "PLATFORM") {
    return { workspaceId: null, projectId: null };
  }
  if (target.scope === "WORKSPACE") {
    return { workspaceId: target.workspaceId, projectId: null };
  }
  return { workspaceId: target.workspaceId, projectId: target.projectId };
}

/** Deterministic id of a new role in this pool. */
export function targetRoleId(target: RoleTarget, key: string): string {
  if (target.scope === "PLATFORM") return platformRoleId(key);
  if (target.scope === "WORKSPACE") {
    return workspaceRoleId(target.workspaceId, key);
  }
  return target.projectId
    ? projectRoleId(target.projectId, key)
    : workspaceProjectRoleId(target.workspaceId, key);
}

/**
 * Who's allowed to manage this pool — and in what context their own rights
 * are measured.
 *
 * The workspace's project roles are deliberately tied to the workspace
 * context: they apply in all of its projects, which is no longer a
 * project-level matter. Only project-local roles fall under the project
 * context.
 */
export function targetGuard(target: RoleTarget): {
  permission: Permission;
  ctx: PermissionContext;
} {
  const permission: Permission = "role.manage";
  if (target.scope === "PLATFORM") return { permission, ctx: PLATFORM };
  if (target.scope === "PROJECT" && target.projectId) {
    return { permission, ctx: { projectId: target.projectId } };
  }
  return { permission, ctx: { workspaceId: target.workspaceId } };
}

/**
 * Is the actor allowed to grant this permission via ALLOW in a role of this
 * pool? Nobody hands out what they don't hold themselves — otherwise any
 * role management would be a path to self-promotion.
 *
 * The special case is the same one `targetGuard` above already makes: a
 * workspace-wide project role is managed in the **workspace** context but
 * carries **project** permissions. Since the workspace context no longer
 * holds any project rights, nothing there could ever be granted otherwise.
 * The actor is therefore measured against the key that opens every project
 * for them.
 *
 * This doesn't apply to a project-local role: there the actor was already
 * measured in the project itself, and the question can be answered directly.
 */
export function canGrantIn(
  access: Access,
  target: RoleTarget,
  permission: Permission,
): boolean {
  if (target.scope === "PROJECT" && target.projectId === null)
    return access.has("project.admin.all");
  return access.has(permission);
}

/** The pool a loaded role row belongs to. */
export function targetOfRole(role: {
  scope: "PLATFORM" | "WORKSPACE" | "PROJECT";
  workspaceId: string | null;
  projectId: string | null;
}): RoleTarget | null {
  if (role.scope === "PLATFORM") return { scope: "PLATFORM" };
  if (!role.workspaceId) return null;
  if (role.scope === "WORKSPACE") {
    return { scope: "WORKSPACE", workspaceId: role.workspaceId };
  }
  return {
    scope: "PROJECT",
    workspaceId: role.workspaceId,
    projectId: role.projectId,
  };
}
