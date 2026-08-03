// ─── RBAC: Rollen-Ids ─────────────────────────────────────────────────────────
//
// Rollen-Ids werden deterministisch gebildet. Das macht die Provisionierung
// idempotent (`createMany({ skipDuplicates })`) und erlaubt Lookups per
// `findUnique({ where: { id } })`, ohne dass Prisma einen zusammengesetzten
// Unique-Key über nullable Spalten kennen müsste.
//
// Die Id ist ein getarnter zusammengesetzter Schlüssel — sie darf nirgends
// geparst werden. Wer Scope oder Eigentümer braucht, liest die Spalten.
//
//   sys:WORKSPACE:member       System-Rolle, existiert genau einmal
//   ws:acme:reviewer           eigene Workspace-Rolle
//   wsp:acme:triage            eigene Projektrolle, in allen Projekten von acme
//   pr:p_7f3a:triage           eigene Projektrolle, nur in diesem Projekt

import type { RoleScope } from "./permissions";

/** System-Rolle — ohne Bindung an Workspace oder Projekt. */
export function systemRoleId(scope: RoleScope, key: string): string {
  return `sys:${scope}:${key}`;
}

/** Eigene Rolle im Scope WORKSPACE, gehört diesem Workspace. */
export function workspaceRoleId(workspaceId: string, key: string): string {
  return `ws:${workspaceId}:${key}`;
}

/** Eigene Rolle im Scope PROJECT, gehört dem Workspace (gilt in allen Projekten). */
export function workspaceProjectRoleId(
  workspaceId: string,
  key: string,
): string {
  return `wsp:${workspaceId}:${key}`;
}

/** Eigene Rolle im Scope PROJECT, gehört genau einem Projekt. */
export function projectRoleId(projectId: string, key: string): string {
  return `pr:${projectId}:${key}`;
}
