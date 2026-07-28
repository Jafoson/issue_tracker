import type { IssueType, Label, Project, User } from "@/types";

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
