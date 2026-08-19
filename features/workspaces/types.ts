import type { ProjectVisibility } from "@/features/projects/types";
import type { Project, Role, User } from "@/types";

// Die Ansichten der Workspace-Einstellungen. Jede ist das, was genau eine Seite
// rendert: fertige Zeilen plus die Frage, was der Handelnde damit darf. Die
// Rechte löst der Server auf — keine Komponente hier baut Regeln nach.

/** Eine wichtige externe Adresse des Workspace — Dokumentation, Repository, Chat. */
export interface WorkspaceLinkRow {
  id: string;
  label: string;
  url: string;
}

/** Allgemein: Stammdaten des Workspace und was daran hängt. */
export interface WorkspaceSettingsView {
  workspace: {
    id: string;
    name: string;
    slug: string;
    color: string;
    /** Wozu der Workspace da ist — leer, wenn es niemand gesagt hat. */
    desc: string;
    avatarUrl: string | null;
    projectCount: number;
    memberCount: number;
    issueCount: number;
    links: WorkspaceLinkRow[];
    /** E-Mail-Domains, über die neue Konten automatisch beitreten
     * (`addWorkspaceDomain`/`removeWorkspaceDomain`). */
    domains: string[];
  };
  /** `workspace.update` — Name, Farbe, Beschreibung und Links. */
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
  avatarUrl: string | null;
  /** Wofür das Projekt da ist — leer, wenn es niemand gesagt hat. */
  desc: string;
  visibility: ProjectVisibility;
  issueCount: number;
  memberCount: number;
  /**
   * Die ersten Mitglieder für den Avatar-Stapel — nicht die ganze Liste. Wie
   * viele es insgesamt sind, sagt `memberCount`; die Gesichter beantworten die
   * andere Frage („bin ich da drin, wer noch?"), und dafür reichen vier.
   */
  members: User[];
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
  /** Die eine Liste, wenn `seesAllProjects` nicht gilt — sonst leer, siehe
   * `publicRows`/`privateRows`. */
  rows: WorkspaceProjectRow[];
  /** Nur bei `seesAllProjects`: die offenen Projekte. */
  publicRows: WorkspaceProjectRow[];
  /** Nur bei `seesAllProjects`: die privaten Projekte. */
  privateRows: WorkspaceProjectRow[];
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
  /** Cursor für `rows` (ohne `seesAllProjects`), sonst `null`. */
  nextCursor: string | null;
  /** Cursor für `publicRows`, sonst `null`. */
  publicNextCursor: string | null;
  /** Cursor für `privateRows`, sonst `null`. */
  privateNextCursor: string | null;
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
  /** Cursor für `own`, `null` wenn schon alles geladen ist. */
  ownNextCursor: string | null;
  /** Cursor für `fromProjects`, `null` wenn schon alles geladen ist. */
  fromProjectsNextCursor: string | null;
}

/**
 * Ein Projekt, das an einem Team hängt — mit der Rolle, die das Team dort
 * verleiht. `role` ist `null`, wenn die Verknüpfung nur zur Gruppierung da
 * ist, ohne dass Mitglieder dadurch Zugriff bekommen.
 */
export interface TeamProjectRow {
  id: string;
  name: string;
  color: string;
  role: { key: string; name: string; rank: number } | null;
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
  projects: TeamProjectRow[];
  /** Offene Aufgaben in den Projekten dieses Teams. */
  openIssues: number;
}

export interface WorkspaceTeamsView {
  rows: WorkspaceTeamRow[];
  /** Auswahl für den Dialog: Mitglieder des Workspace. */
  candidates: User[];
  /** Auswahl für den Dialog: Projekte des Workspace. */
  projects: { id: string; name: string; color: string }[];
  /**
   * Rollen, die sich im Dialog einem Projekt zuweisen lassen — die
   * Projektrollen des Workspace (system oder eigen), die in allen seinen
   * Projekten gelten. Projektlokale Rollen einzelner Projekte stehen hier
   * bewusst nicht: ein Team kann mehrere Projekte umfassen, eine Rolle, die
   * nur in einem davon existiert, wäre in den anderen keine gültige Wahl.
   *
   * Ob eine gewählte Rolle im konkreten Projekt tatsächlich vergeben werden
   * darf, prüft `resolveTeamProjectRoles` beim Speichern serverseitig —
   * diese Liste ist nur die Auswahl im Dialog, keine Zusage.
   */
  assignableProjectRoles: { key: string; name: string; rank: number }[];
  /** `team.create` */
  canCreate: boolean;
  /** `team.update` — Name, Kürzel, Farbe, Lead. */
  canUpdate: boolean;
  /** `team.delete` */
  canDelete: boolean;
  /** `team.member.manage` — wer im Team ist. */
  canManageMembers: boolean;
  /** `team.project.manage` — welche Projekte zum Team gehören, mit welcher Rolle. */
  canManageProjects: boolean;
  /** Id des letzten Teams dieser Seite, für `loadMoreWorkspaceTeams` — `null`,
   * wenn `rows` schon alles ist. */
  nextCursor: string | null;
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
  /** Id des letzten Mitglieds dieser Seite, für `loadMoreWorkspaceMembers` —
   * `null`, wenn `rows` schon alles ist. */
  nextCursor: string | null;
}

/** Eine noch nicht angenommene Einladung, wie ihre Zeile sie zeigt. */
export interface PendingInvitationRow {
  token: string;
  email: string;
  /** Name des Schatten-Kontos — bis zur Annahme nur der lokale Teil der
   * Adresse (siehe `inviteOneWorkspaceMember`), danach zeigt die Person
   * ohnehin nicht mehr hier. */
  firstName: string;
  lastName: string;
  roleName: string;
  /** `null` bei Zeilen von vor der `invitedById`-Spalte oder wenn das
   * einladende Konto seither gelöscht wurde. */
  invitedByName: string | null;
  createdAt: Date;
  expires: Date;
  expired: boolean;
}

export interface PendingInvitationsView {
  rows: PendingInvitationRow[];
  /** `member.invite` — dieselbe Berechtigung wie fürs Einladen selbst. */
  canManage: boolean;
  /** Token der letzten Zeile dieser Seite, für `loadMorePendingInvitations`
   * — `null`, wenn `rows` schon alles ist. */
  nextCursor: string | null;
}

/** Der teilbare Einladungslink eines Scopes (Workspace oder Projekt). */
export interface ActiveInviteLink {
  token: string;
  url: string;
  roleId: string;
  roleName: string;
  expiresAt: Date | null;
}

export interface InviteLinkView {
  /** `null`, wenn (noch) kein Link aktiv ist. */
  activeLink: ActiveInviteLink | null;
  /** Rollen, die der aktuelle User vergeben darf. */
  assignableRoles: Role[];
  canManage: boolean;
}
