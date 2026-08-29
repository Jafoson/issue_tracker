// ─── RBAC: role ids ─────────────────────────────────────────────────────────────
//
// Role ids are built deterministically. This makes provisioning idempotent
// (`createMany({ skipDuplicates })`) and allows lookups via
// `findUnique({ where: { id } })`, without Prisma needing to know a
// composite unique key over nullable columns.
//
// The id is a disguised composite key — it must never be parsed anywhere.
// Whoever needs the scope or owner reads the columns instead.
//
//   sys:WORKSPACE:member       system role, exists exactly once
//   pf:auditor                 custom platform role
//   ws:acme:reviewer           custom workspace role
//   wsp:acme:triage            custom project role, in all of acme's projects
//   pr:p_7f3a:triage           custom project role, only in this project

import type { RoleScope } from "./permissions";

/** System role — with no binding to a workspace or project. */
export function systemRoleId(scope: RoleScope, key: string): string {
  return `sys:${scope}:${key}`;
}

/**
 * Custom role in scope PLATFORM — also belongs to no one, but is not a
 * system role. Its own prefix, so `sys:` keeps meaning exactly what it says:
 * a shared default role from `lib/rbac/roles.ts`.
 */
export function platformRoleId(key: string): string {
  return `pf:${key}`;
}

/** Custom role in scope WORKSPACE, belongs to this workspace. */
export function workspaceRoleId(workspaceId: string, key: string): string {
  return `ws:${workspaceId}:${key}`;
}

/** Custom role in scope PROJECT, belongs to the workspace (applies in all projects). */
export function workspaceProjectRoleId(
  workspaceId: string,
  key: string,
): string {
  return `wsp:${workspaceId}:${key}`;
}

/** Custom role in scope PROJECT, belongs to exactly one project. */
export function projectRoleId(projectId: string, key: string): string {
  return `pr:${projectId}:${key}`;
}
