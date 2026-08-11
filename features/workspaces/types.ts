import type { ProjectVisibility } from "@/features/projects/types";
import type { Project, Role, User } from "@/types";

// Die Ansichten der Workspace-Einstellungen. Jede ist das, was genau eine Seite
// rendert: fertige Zeilen plus die Frage, was der Handelnde damit darf. Die
// Rechte löst der Server auf — keine Komponente hier baut Regeln nach.

/** Allgemein: Stammdaten des Workspace und was daran hängt. */
export interface WorkspaceSettingsView {
  workspace: {
    id: string;
    name: string;
    slug: string;
    color: string;
    projectCount: number;
    memberCount: number;
    issueCount: number;
  };
  /** `workspace.update` — Name und Farbe. */
  canUpdate: boolean;
  /** `workspace.delete` — den Workspace mit allem darin löschen. */
  canDelete: boolean;
}

/**
 * Ein Projekt mitsamt dem Workspace, in dem es liegt.
 *
 * Braucht, wer Projekte über Workspace-Grenzen hinweg auflistet: der Name allein
 * sagt dann nicht mehr, welches gemeint ist, und ohne die Workspace-Id lässt
 * sich auch keine Adresse dafür bauen (`/<workspaceId>/project/<slug>/…`).
 */
export interface ProjectWithWorkspace extends Project {
  workspaceId: string;
  workspaceName: string;
}

/** Ein Projekt, wie die Übersicht des Workspace es zeigt. */
export interface WorkspaceProjectRow {
  id: string;
  name: string;
  slug: string;
  prefix: string;
  color: string;
  visibility: ProjectVisibility;
  issueCount: number;
  memberCount: number;
  /**
   * `project.update` in genau diesem Projekt. Die Permission ist projektlokal,
   * also entscheidet sie Zeile für Zeile — wer ein Projekt leitet, darf noch
   * lange nicht alle ändern.
   */
  canUpdate: boolean;
  /** `project.delete` in genau diesem Projekt. */
  canDelete: boolean;
}

export interface WorkspaceProjectsView {
  rows: WorkspaceProjectRow[];
  /** `project.create` — ein neues Projekt im Workspace anlegen. */
  canCreate: boolean;
  /**
   * Der Handelnde sieht jedes Projekt des Workspace — per Generalschlüssel
   * (`project.view.all`, `project.admin.all`) oder als Support.
   *
   * Erst dann darf die Liste nach Sichtbarkeit gruppieren: sonst wäre „Privat"
   * nicht die Menge der privaten Projekte, sondern nur die Auswahl, in der er
   * zufällig Mitglied ist — eine Überschrift, die mehr verspricht als sie hält.
   */
  seesAllProjects: boolean;
}

/** Ein Label, wie die Verwaltungsseite des Workspace es zeigt. */
export interface WorkspaceLabelRow {
  id: string;
  name: string;
  /** Steht so in den Filter-URLs (`?label=…`) und bleibt beim Umbenennen. */
  slug: string;
  color: string;
  /** An wie vielen Aufgaben des Workspace das Label hängt. */
  issueCount: number;
  /**
   * Nur bei Projekt-Labels gesetzt: Name des Projekts, dem es gehört. Die
   * Workspace-Ansicht listet sie mit, ändern lassen sie sich dort, wo sie
   * hingehören.
   */
  projectName?: string;
  /** Slug des besitzenden Projekts — für den Weg zu dessen Labels. */
  projectSlug?: string;
  /** In wie vielen Projekten dieses Workspace-Label ausgeblendet ist. */
  hiddenIn: number;
}

export interface WorkspaceLabelsView {
  /** Labels des Workspace: gelten in jedem Projekt. */
  own: WorkspaceLabelRow[];
  /** Labels, die einzelnen Projekten gehören — hier nur zur Übersicht. */
  fromProjects: WorkspaceLabelRow[];
  /** `label.create` im Workspace-Scope. */
  canCreate: boolean;
  /** `label.update` im Workspace-Scope. */
  canUpdate: boolean;
  /** `label.delete` im Workspace-Scope. */
  canDelete: boolean;
}

/** Ein Team mit allem, was seine Zeile zeigt. */
export interface WorkspaceTeamRow {
  id: string;
  name: string;
  /** Kurzzeichen, eindeutig im Workspace. */
  key: string;
  color: string;
  desc: string;
  /** Die Person, die das Team führt. `null`, wenn ihr Konto weg ist. */
  lead: User | null;
  members: User[];
  projects: { id: string; name: string; color: string }[];
  /** Offene Aufgaben in den Projekten dieses Teams. */
  openIssues: number;
}

export interface WorkspaceTeamsView {
  rows: WorkspaceTeamRow[];
  /** Auswahl für den Dialog: Mitglieder des Workspace. */
  candidates: User[];
  /** Auswahl für den Dialog: Projekte des Workspace. */
  projects: { id: string; name: string; color: string }[];
  /** `team.create` */
  canCreate: boolean;
  /** `team.update` — Name, Kürzel, Farbe, Lead. */
  canUpdate: boolean;
  /** `team.delete` */
  canDelete: boolean;
  /** `team.member.manage` — wer im Team ist. */
  canManageMembers: boolean;
  /** `team.project.manage` — welche Projekte zum Team gehören. */
  canManageProjects: boolean;
}

/** Ein Mitglied des Workspace, wie seine Zeile es zeigt. */
export interface WorkspaceMemberRow {
  user: User;
  /** Rollen-Key im Workspace. */
  role: string;
  roleName: string;
  roleRank: number;
  /** Die Einladung wurde noch nicht angenommen. */
  pending: boolean;
  /** Teams, in denen die Person steht — Name und Farbe genügen der Zeile. */
  teams: { id: string; name: string; color: string }[];
  /** Das ist der gerade eingeloggte User. */
  you: boolean;
  /**
   * Rang, Selbstbezug und Owner-Schutz stehen nicht im Weg. Entschieden vom
   * Server; welche Aktion erlaubt ist, sagen `canSetRole` und `canRemove`.
   */
  manageable: boolean;
}

export interface WorkspaceMembersView {
  rows: WorkspaceMemberRow[];
  /** Rollen, die der aktuelle User vergeben darf. Leer ohne Verwaltungsrecht. */
  assignableRoles: Role[];
  /** `member.invite` */
  canInvite: boolean;
  /** `member.role.update` */
  canSetRole: boolean;
  /** `member.remove` */
  canRemove: boolean;
}
