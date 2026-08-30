import "server-only";
import { cache } from "react";
import type { NotificationEvent } from "@/features/account/types";
import type {
  NotificationFilter,
  NotificationRow,
} from "@/features/notifications/types";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

/** How `NotificationFilter` translates into an additional `where` condition
 *  — `"all"` doesn't restrict anything further. */
function scopeWhere(filter: NotificationFilter) {
  if (filter === "workspace") return { projectId: null };
  if (filter === "project") return { projectId: { not: null } };
  return {};
}

/**
 * The logged-in user's inbox in the active workspace, newest first.
 *
 * `project`/`issue` are consistent on every row: `Notification.projectId`
 * is always the issue's project for issue events, so the single `project`
 * relation supplies everything `identifier` (`PREFIX-KEY`) needs, without
 * additionally going through `issue.project`.
 */
export const getNotifications = cache(
  async (
    workspaceId: string,
    filter: NotificationFilter,
  ): Promise<NotificationRow[]> => {
    const session = await getSession();
    if (!session) return [];

    const rows = await db.notification.findMany({
      where: {
        userId: session.userId,
        workspaceId,
        ...scopeWhere(filter),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        type: true,
        createdAt: true,
        readAt: true,
        actorLabel: true,
        text: true,
        project: { select: { slug: true, name: true, prefix: true } },
        issue: { select: { key: true, title: true, status: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      type: row.type as NotificationEvent,
      createdAt: row.createdAt.getTime(),
      read: row.readAt !== null,
      actorLabel: row.actorLabel,
      text: row.text,
      project: row.project
        ? { slug: row.project.slug, name: row.project.name }
        : null,
      issue:
        row.issue && row.project
          ? {
              identifier: `${row.project.prefix}-${row.issue.key}`,
              title: row.issue.title,
              status: row.issue.status,
            }
          : null,
    }));
  },
);

/** How many unread notifications are waiting in the active workspace — for
 *  the badge on the bell in UserMenu. */
export const getUnreadNotificationCount = cache(
  async (workspaceId: string): Promise<number> => {
    const session = await getSession();
    if (!session) return 0;

    return db.notification.count({
      where: { userId: session.userId, workspaceId, readAt: null },
    });
  },
);
