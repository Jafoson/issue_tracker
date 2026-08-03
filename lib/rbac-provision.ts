import type { Prisma } from "@/lib/generated/prisma/client";
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  SYSTEM_ROLES,
  type SystemRole,
  systemRoleId,
} from "@/lib/rbac";

// Legt die Permission-Tabelle und die System-Rollen an — **einmal pro
// Datenbank**, nicht pro Workspace. Genau darin liegt der Unterschied zum
// früheren Modell: es gibt keine Rollen-Kopien je Mandant mehr, alle zeigen auf
// dieselben Zeilen.
//
// Idempotent über `skipDuplicates`, damit Seed und ein erneuter Aufruf nichts
// zerstören. Bestehende Zeilen werden nicht überschrieben; ändert sich eine
// System-Rolle im Code, braucht das eine Migration (die dann aber nur eine
// Zeile anfassen muss statt einer je Workspace).

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
    // Geteilte Rollen sind nicht editierbar — eine Änderung träfe alle Mandanten.
    editable: false,
    system: true,
  };
}

function grantRows(r: SystemRole) {
  const roleId = systemRoleId(r.scope, r.key);
  return [
    ...r.allow.map((permissionKey) => ({
      roleId,
      permissionKey,
      effect: "ALLOW" as const,
    })),
    ...r.deny.map((permissionKey) => ({
      roleId,
      permissionKey,
      effect: "DENY" as const,
    })),
  ];
}

/**
 * Die Permission-Tabelle mit der Code-Registry abgleichen. Sie ist FK-Ziel für
 * `RolePermission` und muss deshalb vor allen Rollen stehen.
 */
export async function provisionPermissions(tx: Tx): Promise<void> {
  await tx.permission.createMany({
    data: ALL_PERMISSIONS.map((key) => ({ key, desc: PERMISSIONS[key].desc })),
    skipDuplicates: true,
  });
}

/**
 * Permissions und alle System-Rollen aller Scopes. Einmal pro Datenbank.
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
