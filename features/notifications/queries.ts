import "server-only";
import { cache } from "react";
import type { NotificationEvent } from "@/features/account/types";
import type {
  NotificationFilter,
  NotificationRow,
} from "@/features/notifications/types";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

/** Wie `NotificationFilter` in eine zusätzliche `where`-Bedingung übersetzt
 *  wird — `"all"` schränkt nichts weiter ein. */
function scopeWhere(filter: NotificationFilter) {
  if (filter === "workspace") return { projectId: null };
  if (filter === "project") return { projectId: { not: null } };
  return {};
}

/**
 * Die Inbox des eingeloggten Users im aktiven Workspace, neueste zuerst.
 *
 * `project`/`issue` sind bei jeder Zeile konsistent: `Notification.projectId`
 * ist bei Issue-Ereignissen immer das Projekt des Issues, also liefert die
 * eine Relation `project` alles, was `identifier` (`PREFIX-KEY`) braucht, ohne
 * zusätzlich über `issue.project` zu gehen.
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

/** Wie viele ungelesene Benachrichtigungen im aktiven Workspace warten — für
 *  das Badge an der Glocke im UserMenu. */
export const getUnreadNotificationCount = cache(
  async (workspaceId: string): Promise<number> => {
    const session = await getSession();
    if (!session) return 0;

    return db.notification.count({
      where: { userId: session.userId, workspaceId, readAt: null },
    });
  },
);
