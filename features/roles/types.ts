import type { RoleScope } from "@/lib/rbac";

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
  /** Die Permission-Keys, die diese Rolle hat. */
  grants: string[];
  /** Der Handelnde darf diese Rolle ändern (Rang, `editable`, Berechtigung). */
  manageable: boolean;
  /**
   * Wie viele Personen sie **in diesem Topf** tragen — im Projekt also die
   * Mitglieder dieses Projekts, im Workspace die seinen.
   *
   * Geteilte Standardrollen tragen plattformweit Hunderte; die Zahl beantwortet
   * hier aber „wie viele bei uns", und das ist die einzige, mit der man auf
   * dieser Seite etwas anfangen kann.
   */
  memberCount: number;
  /**
   * Wie viele sie überhaupt tragen, über alle Workspaces und Projekte hinweg.
   *
   * Nur dafür da, die Löschbarkeit zu beantworten: der Fremdschlüssel steht auf
   * RESTRICT, und der zählt nicht nach Töpfen.
   */
  totalCarriers: number;
}

/**
 * Eine Änderung an genau einem Permission-Eintrag.
 *
 * Dieselbe Form nimmt die Matrix entgegen und die Action wieder an: zwischen
 * beiden liegt der Speichern-Knopf, der einen Stapel davon sammelt.
 */
export interface GrantChange {
  roleId: string;
  permission: string;
  /** `true` gibt der Rolle die Permission, `false` nimmt sie ihr. */
  granted: boolean;
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
