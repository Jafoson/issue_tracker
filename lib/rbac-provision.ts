import type { Prisma } from "@/lib/generated/prisma/client";
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  SYSTEM_ROLES,
  type SystemRole,
  systemRoleId,
} from "@/lib/rbac";

// Creates the permission table and the system roles — **once per
// database**, not per workspace. This is exactly the difference from the
// earlier model: there are no more per-tenant role copies, all tenants point
// at the same rows.
//
// Idempotent via `skipDuplicates`, so the seed and a repeat call don't
// destroy anything. Existing rows are never overwritten; if a system role
// changes in code, that needs a migration (which then only has to touch one
// row instead of one per workspace).

type Tx = Prisma.TransactionClient;

function roleRow(r: SystemRole) {
  return {
    id: systemRoleId(r.scope, r.key),
    scope: r.scope,
    workspaceId: null,
    projectId: null,
    key: r.key,
    name: r.name,
    desc: r.desc,
    rank: r.rank,
    // Shared roles are not editable — a change would affect every tenant.
    editable: false,
    system: true,
  };
}

function grantRows(r: SystemRole) {
  const roleId = systemRoleId(r.scope, r.key);
  return r.allow.map((permissionKey) => ({ roleId, permissionKey }));
}

/**
 * Sync the permission table with the code registry. It's the FK target for
 * `RolePermission` and must therefore be provisioned before any roles.
 */
export async function provisionPermissions(tx: Tx): Promise<void> {
  await tx.permission.createMany({
    data: ALL_PERMISSIONS.map((key) => ({ key, desc: PERMISSIONS[key].desc })),
    skipDuplicates: true,
  });
}

/**
 * Permissions and all system roles of all scopes. Once per database.
 */
export async function provisionSystemRbac(tx: Tx): Promise<void> {
  await provisionPermissions(tx);

  await tx.role.createMany({
    data: SYSTEM_ROLES.map(roleRow),
    skipDuplicates: true,
  });

  await tx.rolePermission.createMany({
    data: SYSTEM_ROLES.flatMap(grantRows),
    skipDuplicates: true,
  });
}
