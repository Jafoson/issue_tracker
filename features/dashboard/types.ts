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
