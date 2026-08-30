import type { NotificationEvent } from "@/features/account/types";

/**
 * The three areas the inbox filters by — in exactly this order in the UI
 * too (`SegmentedControl`).
 *
 * "workspace" means: not tied to a specific project (role changes and
 * invitations at the workspace level). "project" means: tied to a project —
 * that includes every issue event, since an issue always belongs to a
 * project.
 */
export type NotificationFilter = "all" | "workspace" | "project";

export interface NotificationRow {
  id: string;
  type: NotificationEvent;
  createdAt: number;
  read: boolean;
  actorLabel: string;
  /** Role name, status key, or comment preview — depending on `type`. */
  text: string;
  project: { slug: string; name: string } | null;
  issue: { identifier: string; title: string; status: string } | null;
}
