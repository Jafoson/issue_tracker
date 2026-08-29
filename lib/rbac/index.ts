// Public API of the RBAC registry. Dependency-free — importable from the
// runtime, the seed, scripts, and tests.
//
// The model in one paragraph: roles have a **scope** (PLATFORM, WORKSPACE,
// PROJECT). A permission key only names object and action (`issue.create`);
// where it takes effect is decided by the scope of the role that carries it.
// The default roles live exactly once in the database and belong to no one;
// custom roles are attached to a workspace or a project. A user has one
// platform role, one role per workspace (`WorkspaceMember`), and one per
// project (`ProjectMember`). Whichever level is in question is what gets
// asked: in a project the project role decides, in a workspace the
// workspace role. A role only ever lists what it allows — there's no
// opposite. This is evaluated in `lib/permissions.ts`.

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
  defaultProjectRoleKeyOf,
  OWNER_ROLE_KEY,
  PLATFORM_ADMIN_ROLE_KEY,
  PLATFORM_SUPPORT_ROLE_KEY,
  PROJECT_ADMIN_ROLE_KEY,
  PROJECT_BLOCKED_ROLE_KEY,
  PROJECT_GUEST_ROLE_KEY,
  PROJECT_VIEWER_ROLE_KEY,
  roleColor,
  SYSTEM_ROLES,
  type SystemRole,
  systemRolesIn,
  WORKSPACE_GUEST_ROLE_KEY,
  WORKSPACE_VIEWER_ROLE_KEY,
} from "./roles";
