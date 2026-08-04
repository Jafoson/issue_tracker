// Öffentliche API der RBAC-Registry. Abhängigkeitsfrei — importierbar aus der
// Runtime, dem Seed, Skripten und Tests.
//
// Das Modell in einem Absatz: Rollen haben einen **Scope** (PLATFORM,
// WORKSPACE, PROJECT). Ein Permission-Key nennt nur Objekt und Aktion
// (`issue.create`); wo er wirkt, sagt der Scope der Rolle, die ihn trägt. Die
// Default-Rollen liegen genau einmal in der Datenbank und gehören niemandem;
// selbst angelegte Rollen hängen am Workspace oder am Projekt. Ein Benutzer hat
// eine Plattform-Rolle, eine Rolle je Workspace (`WorkspaceMember`) und eine je
// Projekt (`ProjectMember`). Gefragt wird immer die Ebene, um die es geht: im
// Projekt entscheidet die Projektrolle, im Workspace die Workspace-Rolle. Ein
// DENY sticht über alle Ebenen. Ausgewertet wird das in `lib/permissions.ts`.

export {
  platformRoleId,
  projectRoleId,
  systemRoleId,
  workspaceProjectRoleId,
  workspaceRoleId,
} from "./id";
export {
  ALL_PERMISSIONS,
  isPermissionAllowedIn,
  PERMISSIONS,
  type Permission,
  type PermissionEffect,
  permissionDesc,
  permissionsFor,
  ROLE_SCOPES,
  type RoleScope,
  toPermission,
  toRoleScope,
} from "./permissions";
export {
  DEFAULT_PLATFORM_ROLE_KEY,
  DEFAULT_PROJECT_ROLE_KEY,
  DEFAULT_WORKSPACE_ROLE_KEY,
  OWNER_ROLE_KEY,
  PROJECT_ADMIN_ROLE_KEY,
  PROJECT_BLOCKED_ROLE_KEY,
  PROJECT_GUEST_ROLE_KEY,
  PROJECT_VIEWER_ROLE_KEY,
  roleColor,
  SYSTEM_ROLES,
  type SystemRole,
  systemRolesIn,
} from "./roles";
