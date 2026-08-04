import "server-only";
import type { RoleTarget } from "@/features/roles/types";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
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

// Ein Rollen-Topf beantwortet drei Fragen, die immer zusammengehören: welche
// Rollen zählen dazu, wer darf sie verwalten, und in welchem Kontext werden die
// Rechte des Handelnden gemessen. Sie hier gebündelt zu halten verhindert, dass
// eine Aktion die Rollen des einen und die Prüfung des anderen Topfes erwischt.

/**
 * Alle Rollen, die in diesem Topf gelten — die geteilten System-Rollen des
 * Scopes plus die eigenen des Workspace bzw. Projekts.
 *
 * Die System-Rollen haben keinen Eigentümer und gehören deshalb zu jedem Topf
 * ihres Scopes. Genau das ersetzt die früheren Kopien je Workspace.
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
  // Im Projekt sind auch die Projektrollen des Workspace zuweisbar; die
  // projektlokalen kommen nur bei einem konkreten Projekt hinzu.
  return {
    scope: "PROJECT",
    OR: [
      { system: true },
      { workspaceId: target.workspaceId, projectId: null },
      ...(target.projectId ? [{ projectId: target.projectId }] : []),
    ],
  };
}

/** Die Eigentümerspalten, die eine neue Rolle in diesem Topf bekommt. */
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

/** Deterministische Id einer neuen Rolle in diesem Topf. */
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
 * Wer diesen Topf verwalten darf — und in welchem Kontext seine eigenen Rechte
 * gemessen werden.
 *
 * Die Projektrollen des Workspace hängen bewusst am Workspace-Kontext: sie
 * gelten in allen seinen Projekten, das ist keine Projektsache mehr. Nur die
 * projektlokalen Rollen fallen unter den Projekt-Kontext.
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

/** Der Topf, zu dem eine geladene Rollen-Zeile gehört. */
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
