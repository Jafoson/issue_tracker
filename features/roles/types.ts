import type { RoleScope } from "@/lib/rbac";

/**
 * Which pool of roles is meant.
 *
 * The PROJECT scope occurs twice: with `projectId: null` these are the
 * roles the workspace creates for all of its projects; with `projectId`,
 * the roles of exactly one project. The shared system roles belong to every
 * pool of their scope — they have no owner.
 */
export type RoleTarget =
  | { scope: "PLATFORM" }
  | { scope: "WORKSPACE"; workspaceId: string }
  | { scope: "PROJECT"; workspaceId: string; projectId: string | null };

export interface RoleView {
  id: string;
  key: string;
  name: string;
  desc: string;
  rank: number;
  /** Shared default role: belongs to nobody, applies to every tenant. */
  system: boolean;
  /** Belongs to exactly one project instead of the workspace. */
  local: boolean;
  /** The permission keys this role has. */
  grants: string[];
  /** The actor is allowed to change this role (rank, `editable`, permission). */
  manageable: boolean;
  /**
   * How many people carry it **in this pool** — in a project, the members of
   * that project; in a workspace, its members.
   *
   * Shared default roles carry hundreds platform-wide; but the number here
   * answers "how many at our place", and that's the only one useful on this
   * page.
   */
  memberCount: number;
  /**
   * How many carry it in total, across every workspace and project.
   *
   * Only here to answer whether it can be deleted: the foreign key is set
   * to RESTRICT, and that doesn't count per pool.
   */
  totalCarriers: number;
}

/**
 * A change to exactly one permission entry.
 *
 * The same shape is both accepted by the matrix and sent back to the
 * action: between the two sits the save button, which collects a batch of
 * these.
 */
export interface GrantChange {
  roleId: string;
  permission: string;
  /** `true` gives the role the permission, `false` takes it away. */
  granted: boolean;
}

/** Everything a role editor renders. */
export interface RoleManagerView {
  target: RoleTarget;
  roles: RoleView[];
  /** Permissions that may be assigned in this scope. */
  permissions: { key: string; desc: string }[];
  /** Whether anything may be changed at all. */
  canManage: boolean;
  /**
   * Permissions the actor holds themselves. Only these may they pass on via
   * ALLOW — otherwise any role manager could promote themselves.
   */
  grantable: string[];
  /** Highest rank they're allowed to assign. */
  maxRank: number;
}

export type { RoleScope };
