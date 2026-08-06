import type { PMDoc } from "@/lib/richtext/types";
import type {
  IssueType,
  Label,
  Priority,
  Project,
  SearchableIssue,
  Status,
  User,
} from "@/types";

/**
 * Nachschlagedaten, mit denen eine Issue-Karte die IDs am Issue auflöst:
 * Projekt-Prefix, Assignee, Labelnamen, Typfarbe.
 *
 * Bewusst als Bündel statt als Einzel-Props — das Board und seine Spalten
 * benutzen nichts davon selbst, sie reichen es nur bis zur Karte durch.
 */
export interface IssueLookups {
  projects: Project[];
  members: User[];
  labels: Label[];
  issueTypes: IssueType[];
}

/**
 * Workspace-Daten, die eine Bearbeitungsoberfläche für ein Issue braucht:
 * jeder Picker (Status, Priorität, Assignee, Label, Projekt) arbeitet auf einer
 * dieser Listen, und `me` steht am erzeugten Datensatz.
 *
 * Wird von einer Server Component geholt und als Prop hereingereicht — Modals
 * werden aus Client-Kontexten heraus geöffnet und können nicht selbst abfragen.
 */
export interface IssueEditorData {
  workspaceId: string;
  me: User;
  projects: Project[];
  members: User[];
  labels: Label[];
  statuses: Status[];
  priorities: Priority[];
  /** Für den `#`-Trigger im Editor — Issues des Workspace zum Verlinken. */
  searchIssues: SearchableIssue[];
}

/** Der Composer braucht zusätzlich die Issue-Typen für seinen Typ-Picker. */
export interface IssueComposerData extends IssueEditorData {
  issueTypes: IssueType[];
  /**
   * Projekte, in denen der Benutzer `issue.create` hat — die Teilmenge von
   * `projects`, in der ein neues Issue entstehen darf.
   *
   * Bewusst eine eigene Liste und keine Filterung von `projects`: die dient auch
   * als Nachschlagetabelle für bestehende Issues (Prefix, Farbe). Wer sie
   * kürzte, um Knöpfe zu verstecken, hätte Karten ohne Projektnamen.
   *
   * Leer heißt: kein „Neues Issue" — nirgends. Entschieden wird das in
   * `features/issues/editor-data.ts`, nicht in den vier Knöpfen.
   */
  creatableProjectIds: string[];
}

/**
 * Teiländerung an einem Issue — genau die Felder, die `updateIssue` schreibt.
 * Jede Oberfläche, die einen Picker anbietet (Liste, Board, Detailansicht),
 * reicht darüber ihre Änderung durch.
 */
export interface IssuePatch {
  status?: string;
  priority?: number;
  type?: string;
  assignee?: string | null;
  labels?: string[];
  title?: string;
  description?: PMDoc;
}
