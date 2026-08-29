"use server";

import { revalidatePath } from "next/cache";
import {
  canGrantIn,
  ownerColumns,
  rolesInTarget,
  targetGuard,
  targetOfRole,
  targetRoleId,
} from "@/features/roles/scope";
import type { GrantChange, RoleTarget } from "@/features/roles/types";
import { db } from "@/lib/db";
import {
  type Access,
  accessFor,
  assignmentCeiling,
  currentUserId,
} from "@/lib/permissions";
import {
  isPermissionAllowedIn,
  type Permission,
  toPermission,
} from "@/lib/rbac";
import { slugify } from "@/lib/slug";

type RoleResult = { ok: true } | { error: string };

// Role management. Three rules run through every action:
//
//   1. System roles are untouchable. They're the same row for every tenant —
//      a change would hit everyone. Whoever needs a variant creates their
//      own role.
//   2. Nobody touches a role ranked above their own and nobody creates one
//      above it.
//   3. Nobody gives a role a permission they don't hold themselves.
//      Otherwise any role management would be a path to self-promotion.
//      Taking away, on the other hand, is allowed for anyone managing the
//      role — that never expands anyone's rights.

async function revalidate() {
  revalidatePath("/", "layout");
}

interface Guard {
  actorId: string;
  access: Access;
  ceiling: number;
}

/** Checks the pool's management permission and determines the rank ceiling. */
async function requireTargetManage(
  target: RoleTarget,
): Promise<Guard | { error: string }> {
  const actorId = await currentUserId();
  if (!actorId) return { error: "You must be logged in." };

  const { permission, ctx } = targetGuard(target);
  const access = await accessFor(actorId, ctx);
  if (!access.has(permission))
    return { error: "You are not allowed to manage roles here." };

  return { actorId, access, ceiling: assignmentCeiling(access, target.scope) };
}

/** Loads a role along with its pool and checks the permission for it. */
async function requireRoleManage(roleId: string): Promise<
  | {
      guard: Guard;
      target: RoleTarget;
      role: { id: string; rank: number };
    }
  | { error: string }
> {
  const role = await db.role.findUnique({
    where: { id: roleId },
    select: {
      id: true,
      rank: true,
      editable: true,
      system: true,
      scope: true,
      workspaceId: true,
      projectId: true,
    },
  });
  if (!role) return { error: "This role no longer exists." };

  if (role.system) {
    return {
      error:
        "This is a shared default role and cannot be changed. Create your own role instead.",
    };
  }
  if (!role.editable)
    return { error: "This role is protected and cannot be changed." };

  const target = targetOfRole(role);
  if (!target) return { error: "This role no longer exists." };

  const guard = await requireTargetManage(target);
  if ("error" in guard) return guard;

  if (role.rank > guard.ceiling)
    return { error: "You cannot change a role ranked above your own." };

  return { guard, target, role };
}

// ─── Create ─────────────────────────────────────────────────────────────────

export async function createRole(
  target: RoleTarget,
  data: { name: string; desc?: string; rank?: number },
): Promise<RoleResult> {
  const guard = await requireTargetManage(target);
  if ("error" in guard) return guard;

  const name = data.name.trim();
  if (!name) return { error: "Name is required." };

  const rank = Number.isFinite(data.rank) ? Number(data.rank) : 1;
  if (rank < 0) return { error: "Rank cannot be negative." };
  if (rank > guard.ceiling)
    return { error: "You cannot create a role above your own rank." };

  const key = await uniqueKey(target, slugify(name) || "role");
  const owner = ownerColumns(target);

  await db.role.create({
    data: {
      id: targetRoleId(target, key),
      scope: target.scope,
      workspaceId: owner.workspaceId,
      projectId: owner.projectId,
      key,
      name,
      desc: data.desc?.trim() ?? "",
      rank,
      editable: true,
      system: false,
    },
  });

  await revalidate();
  return { ok: true };
}

/** Appends -2, -3, … until the key is free within the pool. */
async function uniqueKey(target: RoleTarget, base: string): Promise<string> {
  const where = rolesInTarget(target);
  let key = base;
  let n = 1;
  while (
    await db.role.findFirst({ where: { ...where, key }, select: { id: true } })
  ) {
    key = `${base}-${++n}`;
  }
  return key;
}

// ─── Update ─────────────────────────────────────────────────────────────────

export async function updateRole(
  roleId: string,
  data: { name?: string; desc?: string; rank?: number },
): Promise<RoleResult> {
  const found = await requireRoleManage(roleId);
  if ("error" in found) return found;

  const name = data.name?.trim();
  if (name !== undefined && !name) return { error: "Name is required." };

  if (data.rank !== undefined) {
    if (!Number.isFinite(data.rank) || data.rank < 0)
      return { error: "Rank must be zero or higher." };
    if (data.rank > found.guard.ceiling)
      return { error: "You cannot raise a role above your own rank." };
  }

  await db.role.update({
    where: { id: roleId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(data.desc !== undefined ? { desc: data.desc.trim() } : {}),
      ...(data.rank !== undefined ? { rank: data.rank } : {}),
    },
  });

  await revalidate();
  return { ok: true };
}

// ─── Delete ─────────────────────────────────────────────────────────────────

export async function deleteRole(roleId: string): Promise<RoleResult> {
  const found = await requireRoleManage(roleId);
  if ("error" in found) return found;

  // The foreign keys are set to RESTRICT — this is the understandable error
  // message in front of that, not the actual safeguard.
  const inUse = await db.role.findUnique({
    where: { id: roleId },
    select: {
      _count: {
        select: {
          workspaceMembers: true,
          projectMembers: true,
          platformUsers: true,
        },
      },
    },
  });
  const carriers =
    (inUse?._count.workspaceMembers ?? 0) +
    (inUse?._count.projectMembers ?? 0) +
    (inUse?._count.platformUsers ?? 0);
  if (carriers > 0)
    return {
      error: "Someone still has this role. Move them to another one first.",
    };

  await db.role.delete({ where: { id: roleId } });

  await revalidate();
  return { ok: true };
}

// ─── Set permissions ────────────────────────────────────────────────────────

/** Gives a role a permission (`granted`) or takes it away again. */
export async function setRoleGrant(
  roleId: string,
  permissionKey: string,
  granted: boolean,
): Promise<RoleResult> {
  return setRoleGrants([{ roleId, permission: permissionKey, granted }]);
}

/**
 * Writes an entire batch of entries — what the matrix's save button submits.
 *
 * All or nothing: every single change is checked first, writing happens
 * afterward in one transaction. A half-applied batch would be the worst
 * possible outcome for permissions — the UI would show an error, and yet
 * half the rights would already have shifted.
 */
export async function setRoleGrants(
  changes: GrantChange[],
): Promise<RoleResult> {
  if (changes.length === 0) return { ok: true };

  // A batch touches a handful of roles and many cells. Checking a role loads
  // it and weighs its rank against the actor's — that cost is therefore
  // paid once per role, not once per change.
  const checked = new Map<
    string,
    Awaited<ReturnType<typeof requireRoleManage>>
  >();

  const writes: {
    roleId: string;
    permission: Permission;
    granted: boolean;
  }[] = [];

  for (const change of changes) {
    let found = checked.get(change.roleId);
    if (!found) {
      found = await requireRoleManage(change.roleId);
      checked.set(change.roleId, found);
    }
    if ("error" in found) return found;

    const permission = toPermission(change.permission);
    if (!permission) return { error: "Unknown permission." };

    // Not every permission makes sense in every scope — `workspace.update`
    // doesn't belong on a project role.
    if (!isPermissionAllowedIn(permission, found.target.scope))
      return { error: "That permission does not apply in this scope." };

    // Only someone who holds the permission themselves can grant it. Anyone
    // managing the role can take it away — that never expands anyone's rights.
    if (
      change.granted &&
      !canGrantIn(found.guard.access, found.target, permission)
    )
      return { error: "You cannot grant a permission you do not have." };

    writes.push({ roleId: change.roleId, permission, granted: change.granted });
  }

  // The queries are only built here: doing it above would leave half a
  // dozen finished write operations sitting around after an error, never
  // to be submitted.
  await db.$transaction(
    writes.map(({ roleId, permission, granted }) =>
      granted
        ? db.rolePermission.upsert({
            where: {
              roleId_permissionKey: { roleId, permissionKey: permission },
            },
            update: {},
            create: { roleId, permissionKey: permission },
          })
        : db.rolePermission.deleteMany({
            where: { roleId, permissionKey: permission },
          }),
    ),
  );

  await revalidate();
  return { ok: true };
}
