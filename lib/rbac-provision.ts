import type { Prisma } from "@/lib/generated/prisma/client";
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLES,
  PERMISSION_DESCRIPTIONS,
} from "@/lib/rbac";

// Stabile, deterministische Role-Id pro Workspace — macht die Provisionierung
// idempotent (re-runnable über createMany + skipDuplicates).
export function roleId(workspaceId: string, key: string): string {
  return `${workspaceId}:${key}`;
}

/**
 * Legt für einen Workspace die globalen Permissions sowie die 7 Default-Rollen
 * inklusive ihrer Permission-Zuordnungen an. Idempotent: vorhandene Zeilen
 * werden übersprungen. Funktioniert sowohl mit dem PrismaClient (Seed) als auch
 * innerhalb einer Transaktion (createWorkspace).
 */
export async function provisionWorkspaceRbac(
  tx: Prisma.TransactionClient,
  workspaceId: string,
): Promise<void> {
  // 1. Globale Permission-Zeilen (FK-Ziel) sicherstellen.
  await tx.permission.createMany({
    data: ALL_PERMISSIONS.map((key) => ({
      key,
      desc: PERMISSION_DESCRIPTIONS[key],
    })),
    skipDuplicates: true,
  });

  // 2. Default-Rollen für diesen Workspace anlegen.
  await tx.role.createMany({
    data: DEFAULT_ROLES.map((r) => ({
      id: roleId(workspaceId, r.key),
      workspaceId,
      key: r.key,
      name: r.name,
      desc: r.desc,
      rank: r.rank,
      editable: r.editable,
    })),
    skipDuplicates: true,
  });

  // 3. Permission-Zuordnungen je Rolle.
  await tx.rolePermission.createMany({
    data: DEFAULT_ROLES.flatMap((r) =>
      r.permissions.map((permissionKey) => ({
        roleId: roleId(workspaceId, r.key),
        permissionKey,
      })),
    ),
    skipDuplicates: true,
  });
}
