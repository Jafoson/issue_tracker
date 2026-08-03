import type { PermissionEffect, RoleScope } from "@/lib/rbac";

/**
 * Welcher Topf von Rollen gemeint ist.
 *
 * Der Scope PROJECT kommt zweimal vor: mit `projectId: null` sind es die Rollen,
 * die der Workspace für alle seine Projekte anlegt; mit `projectId` die Rollen
 * genau eines Projekts. Die geteilten System-Rollen gehören zu jedem Topf ihres
 * Scopes — sie haben keinen Eigentümer.
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
  /** Geteilte Default-Rolle: gehört niemandem, gilt für alle Mandanten. */
  system: boolean;
  /** Gehört genau einem Projekt statt dem Workspace. */
  local: boolean;
  /** Permission-Key → Wirkung. Fehlt der Key, ist nichts gesetzt. */
  grants: Record<string, PermissionEffect>;
  /** Der Handelnde darf diese Rolle ändern (Rang, `editable`, Berechtigung). */
  manageable: boolean;
  /** Wie viele Personen sie tragen — solange jemand sie trägt, geht kein Löschen. */
  memberCount: number;
}

/** Alles, was ein Rollen-Editor rendert. */
export interface RoleManagerView {
  target: RoleTarget;
  roles: RoleView[];
  /** Permissions, die in diesem Scope vergeben werden dürfen. */
  permissions: { key: string; desc: string }[];
  /** Darf überhaupt etwas geändert werden. */
  canManage: boolean;
  /**
   * Permissions, die der Handelnde selbst besitzt. Nur diese darf er per ALLOW
   * weitergeben — sonst könnte sich jeder Rollenverwalter selbst befördern.
   */
  grantable: string[];
  /** Höchster Rang, den er vergeben darf. */
  maxRank: number;
}

export type { RoleScope };
