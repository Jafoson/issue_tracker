import type { NotificationEvent } from "@/features/account/types";

/**
 * Die drei Bereiche, nach denen die Inbox filtert — in genau dieser
 * Reihenfolge auch in der Oberfläche (`SegmentedControl`).
 *
 * "workspace" heißt: nicht an ein bestimmtes Projekt gebunden (Rollenwechsel
 * und Einladungen auf Workspace-Ebene). "project" heißt: an ein Projekt
 * gebunden — das schließt alle Issue-Ereignisse mit ein, denn ein Issue
 * gehört immer einem Projekt.
 */
export type NotificationFilter = "all" | "workspace" | "project";

export interface NotificationRow {
  id: string;
  type: NotificationEvent;
  createdAt: number;
  read: boolean;
  actorLabel: string;
  /** Rollenname, Statuskey oder Kommentar-Vorschau — je nach `type`. */
  text: string;
  project: { slug: string; name: string } | null;
  issue: { identifier: string; title: string; status: string } | null;
}
