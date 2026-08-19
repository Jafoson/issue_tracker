import type { DashboardScope } from "@/features/dashboard/scope";
import type { WidgetKey } from "@/features/dashboard/widgets";
import type { BucketUnit, RangeKey } from "@/lib/buckets";
import type { User } from "@/types";

// Was das Dashboard eines Projekts anzeigt — fertig gerechnet, wie überall in
// diesem Projekt. Die Oberfläche summiert, sortiert und filtert nichts mehr
// nach: sie zeichnet.

/** Die Kennzahlenreihe ganz oben. */
export interface DashboardStats {
  /** Aufgaben, die weder erledigt noch verworfen sind. */
  open: number;
  inProgress: number;
  inReview: number;
  /** Im gewählten Zeitraum geschlossen. */
  closed: number;
  /** Im gewählten Zeitraum angelegt — die Gegenrichtung zu `closed`. */
  created: number;
  /** Offene Aufgaben höchster Dringlichkeit. */
  urgent: number;
  /** Davon niemandem zugewiesen — eine dringende Aufgabe ohne Namen bleibt liegen. */
  urgentUnassigned: number;
  /** Alle Aufgaben des Projekts, ohne Zeitgrenze. */
  total: number;
  /**
   * Mittlere Durchlaufzeit in Tagen, angelegt bis geschlossen, über die im
   * Zeitraum geschlossenen Aufgaben. `null`, wenn keine geschlossen wurde —
   * „0 Tage" wäre die falsche Antwort auf „noch keine".
   */
  cycleDays: number | null;
}

/** Ein Status mit der Zahl der Aufgaben, die darin stehen. */
export interface StatusSlice {
  id: string;
  name: string;
  short: string;
  color: string;
  count: number;
}

/** Eine Dringlichkeitsstufe mit der Zahl der offenen Aufgaben darin. */
export interface PrioritySlice {
  id: number;
  key: string;
  name: string;
  color: string;
  count: number;
}

/** Eine Marke der Zeitachse: was in ihrem Topf angelegt und geschlossen wurde. */
export interface ThroughputPoint {
  /** Anfang des Topfes, `YYYY-MM-DD`. */
  date: string;
  created: number;
  closed: number;
}

/** Wie viele offene Aufgaben auf einer Person liegen. */
export interface WorkloadRow {
  /** `null` steht für den Stapel ohne Zuständige. */
  user: User | null;
  open: number;
  /** Davon in Arbeit — der Teil, an dem gerade wirklich jemand sitzt. */
  inProgress: number;
}

/** Eine Aufgabe, wie die beiden Listen unten sie zeigen. */
export interface DashboardIssue {
  id: string;
  /** `NIM-142` — die Kennung, unter der man sie sucht. */
  ref: string;
  title: string;
  status: string;
  statusColor: string;
  priority: number;
  assignee: User | null;
  /** Zeitpunkt der letzten Änderung, als Millisekunden. */
  updated: number;
}

/**
 * Warum eine Aufgabe in „Braucht Aufmerksamkeit" steht.
 *
 * Eine Aufgabe kann mehrere Gründe haben; gezeigt wird der schwerste. Die
 * Reihenfolge hier ist die Rangfolge.
 */
export type AttentionReason =
  /** Dringend und niemandem zugewiesen. */
  | "unassigned"
  /** Dringend oder hoch, und offen. */
  | "urgent"
  /** In Arbeit, aber seit zwei Wochen unangetastet. */
  | "stale";

export interface AttentionIssue extends DashboardIssue {
  reason: AttentionReason;
}

export interface ProjectDashboardData {
  range: RangeKey;
  unit: BucketUnit;
  /**
   * Auf wen sich diese Zahlen beziehen — "all" (das ganze Projekt bzw.
   * Workspace) oder "mine" (nur die eigenen Aufgaben). Der tatsächlich
   * angewandte Umfang, nicht der angefragte: wer `dashboard.view.all` nicht
   * trägt, bekommt hier immer "mine", egal was `?scope=` in der Adresse sagt.
   */
  scope: DashboardScope;
  stats: DashboardStats;
  statuses: StatusSlice[];
  priorities: PrioritySlice[];
  throughput: ThroughputPoint[];
  workload: WorkloadRow[];
  attention: AttentionIssue[];
}

/** Ein Team, das auf dieses Projekt zugreift. */
export interface ProjectTeam {
  id: string;
  name: string;
  key: string;
  color: string;
}

/** Ein Label, das in diesem Projekt vergeben wird. */
export interface ProjectLabel {
  id: string;
  name: string;
  color: string;
  /** Der URL-Slug — Filter stehen als Slug in der Adresse, nicht als Id. */
  slug: string;
  /** Gehört dem Projekt allein, nicht dem ganzen Workspace. */
  own: boolean;
}

/**
 * Alle, die im Projekt dieselbe Rolle tragen.
 *
 * Die Gruppen kommen fertig sortiert vom Server (stärkste Rolle zuerst) und
 * tragen den Namen der Rolle, wie er in der Datenbank steht — nicht einen aus
 * einer festen Liste im Code. Ein Workspace, der sich eine projekteigene Rolle
 * „Moderator" anlegt, erscheint damit von selbst als eigene Gruppe, ohne dass
 * hier etwas nachgezogen werden müsste.
 */
export interface ProjectRoleGroup {
  /** Der Rollen-Key, zugleich React-Key der Gruppe. */
  key: string;
  name: string;
  /** Rang der Rolle — bestimmt Reihenfolge und Farbe (`roleColor`). */
  rank: number;
  /**
   * Trägt diese Rolle mehr als das Mitarbeiten? Solche Gruppen stehen oben und
   * mit Namen, die übrigen als kompakte Liste darunter — siehe
   * `ProjectProfileView`.
   */
  distinguished: boolean;
  members: User[];
}

/**
 * Der Steckbrief des Projekts — was es ist, wem es gehört, woraus es besteht.
 *
 * Bewusst getrennt von `ProjectDashboardData`: hier steht nichts, was sich mit
 * dem Zeitraum ändert. Ein Kürzel hat keine 30 Tage.
 */
export interface ProjectProfile {
  /** Wofür das Projekt da ist. Leer heißt, dass es niemand gesagt hat. */
  desc: string;
  /** `NIM` — das Kürzel, unter dem die Aufgaben laufen. */
  prefix: string;
  visibility: "public" | "private";
  createdAt: number;
  createdBy: User | null;
  /**
   * `project.update` — ob der Bearbeiten-Knopf in der Kopfkarte erscheint.
   *
   * Reine Sichtbarkeit, kein Schutz: die Einstellungsseite dahinter prüft
   * selbst. Der Knopf steht nur deshalb nicht für alle da, weil er sonst auf
   * eine Seite führte, an der nichts zu ändern ist.
   */
  canUpdate: boolean;
  /**
   * `role.manage` ODER `label.create` ODER `project.update` — dieselbe Hürde
   * wie beim Einstellungen-Tab (`lib/nav.ts`, `PROJECT_NAV`). Ohne eines der
   * drei gäbe es dort ohnehin nur schreibgeschützte Ansichten zu sehen.
   */
  canViewSettings: boolean;
  /**
   * `dashboard.view.all` — ob der Umschalter zwischen „eigene" und „ganzes
   * Projekt" auf dem Dashboard erscheint. Ohne diese Berechtigung sieht die
   * Person ihr Dashboard ohnehin nur mit `scope: "mine"` (`getProjectDashboard`
   * erzwingt das) — hier steht nur, ob sie überhaupt wählen darf.
   */
  canViewAllStats: boolean;
  /** `label.create` — ob die Labels-Karte einen Hinzufügen-Knopf zeigt. */
  canCreateLabel: boolean;
  /**
   * `team.project.manage` — ob die Teams-Karte einen Pfeil zur Teamverwaltung
   * zeigt. Eine Workspace-Permission, geprüft im Workspace-Kontext: Teams
   * gehören dem Workspace, nicht dem Projekt, und werden auch dort verwaltet
   * (`workspaceSettingsPath(workspaceId, "teams")`) — dieselbe Karte kann also
   * nur verlinken, nicht selbst bearbeiten.
   */
  canManageTeams: boolean;
  /** Wer Zugriff hat, nach Rollen gruppiert. Stärkste Rolle zuerst. */
  roles: ProjectRoleGroup[];
  /** Wie viele Personen insgesamt — die Summe über alle Gruppen. */
  memberCount: number;
  teams: ProjectTeam[];
  labels: ProjectLabel[];
}

/** Was die Seite braucht: die Zahlen, der Steckbrief und die Anordnung. */
export interface ProjectDashboardView {
  project: { id: string; name: string; slug: string; color: string };
  data: ProjectDashboardData;
  profile: ProjectProfile;
  /** Sichtbare Bausteine in ihrer Reihenfolge, plus die abgewählten. */
  order: WidgetKey[];
  hidden: WidgetKey[];
}

// ─── Dasselbe eine Ebene höher: der Workspace ────────────────────────────────
//
// Dieselben Bausteine wie beim Projekt, nur über alle seine Projekte hinweg
// summiert — `WorkspaceDashboardData` trägt deshalb dieselbe Form wie
// `ProjectDashboardData` und keine eigene.

export type WorkspaceDashboardData = ProjectDashboardData;

/** Ein Projekt des Workspace, wie der Steckbrief es verlinkt. */
export interface WorkspaceProjectSummary {
  id: string;
  name: string;
  slug: string;
  color: string;
}

/**
 * Alle, die im Workspace dieselbe Rolle tragen — dieselbe Form wie
 * `ProjectRoleGroup` eine Ebene tiefer, nur gruppiert nach
 * `WorkspaceMember.role` statt `ProjectMember.role`.
 */
export type WorkspaceRoleGroup = ProjectRoleGroup;

/** Eine wichtige externe Adresse — Dokumentation, Repository, Chat. */
export interface WorkspaceLink {
  id: string;
  label: string;
  url: string;
}

/**
 * Der Steckbrief des Workspace — was er ist, wem er gehört, woraus er besteht.
 *
 * Kein `prefix`: der Workspace kennt es nicht, anders als ein Projekt. Dafür
 * die Zahl seiner Projekte — die eine Auskunft, die es beim Projekt-Steckbrief
 * nicht braucht, weil sie dort immer eins ist.
 */
export interface WorkspaceProfile {
  /** Wozu der Workspace da ist. Leer heißt, dass es niemand gesagt hat. */
  desc: string;
  createdAt: number;
  /** `workspace.update` — ob der Bearbeiten-Knopf in der Kopfkarte erscheint. */
  canUpdate: boolean;
  /**
   * `member.view` — ob `roles` die volle Besetzung zeigt (Member/Viewer/Guest)
   * oder nur noch die Leitung. Steuert auch, ob `memberCount` und der Link zur
   * vollen Mitgliederliste erscheinen — die Seite dahinter bleibt ohne dieses
   * Recht ohnehin gesperrt.
   */
  canViewMembers: boolean;
  /**
   * `role.manage` ODER `label.create` ODER `workspace.update` — dieselbe Hürde
   * wie beim Einstellungen-Tab (`lib/nav.ts`, `WORKSPACE_NAV`). Ohne eines der
   * drei gäbe es dort ohnehin nur schreibgeschützte Ansichten zu sehen.
   */
  canViewSettings: boolean;
  /** `dashboard.view.all` — siehe `ProjectProfile.canViewAllStats`. */
  canViewAllStats: boolean;
  /**
   * Wer führt, steht immer da (`distinguished`) — wer nur mitarbeitet oder
   * mitliest, nur mit `member.view` (siehe `canViewMembers`). Ohne das Recht
   * enthält die Liste ausschließlich die ausgezeichneten Gruppen.
   */
  roles: WorkspaceRoleGroup[];
  /**
   * `platform_admin`/`platform_support` mit Durchgriff auf diesen Workspace,
   * ohne eigene `WorkspaceMember`-Zeile — sonst blieben sie im Steckbrief
   * unsichtbar, obwohl sie mehr können als fast jeder in `roles`. Wie die
   * Leitung dort unabhängig von `member.view` sichtbar. Zählt nicht in
   * `memberCount` — das bleibt die Größe der tatsächlichen Mitgliedschaft.
   */
  platformStaff: WorkspaceRoleGroup[];
  memberCount: number;
  teams: ProjectTeam[];
  projects: WorkspaceProjectSummary[];
  /** Wichtige Adressen, als große Chips direkt unter der Kopfkarte. */
  links: WorkspaceLink[];
  /** Ob die Teams- bzw. Projekte-Karte einen Hinzufügen-Knopf zeigt. */
  canCreateProject: boolean;
  canCreateTeam: boolean;
  /** Für den Team-Dialog aus der Übersicht — dieselben Rechte wie auf der Teams-Seite. */
  canManageTeamMembers: boolean;
  canManageTeamProjects: boolean;
  /** Für den Team-Dialog aus der Übersicht — siehe `WorkspaceTeamsView.assignableProjectRoles`. */
  assignableProjectRoles: { key: string; name: string; rank: number }[];
}

/** Was die Workspace-Seite braucht: die Zahlen, der Steckbrief, die Anordnung. */
export interface WorkspaceDashboardView {
  workspace: {
    id: string;
    name: string;
    slug: string;
    color: string;
    avatarUrl: string | null;
  };
  data: WorkspaceDashboardData;
  profile: WorkspaceProfile;
  order: WidgetKey[];
  hidden: WidgetKey[];
}
