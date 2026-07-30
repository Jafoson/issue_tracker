import type {
  IssueType,
  Label,
  Priority,
  Project,
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
}

/** Der Composer braucht zusätzlich die Issue-Typen für seinen Typ-Picker. */
export interface IssueComposerData extends IssueEditorData {
  issueTypes: IssueType[];
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
  description?: string;
}
