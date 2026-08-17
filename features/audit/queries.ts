import "server-only";
import { cache } from "react";
import { ACTIVITY_PAGE_SIZE } from "@/features/audit/constants";
import { listAudit } from "@/lib/audit";
import type { AuditEntry } from "@/lib/audit/actions";
import { accessFor, currentUserId } from "@/lib/permissions";

export interface ActivityView {
  entries: AuditEntry[];
  /** Ob die volle, ungefilterte Liste zu sehen war — steuert z. B. Hinweise
   * in der Oberfläche, dass nur eigene Einträge gezeigt werden. */
  canViewAll: boolean;
  /** Id des letzten Eintrags, ab der `loadMore*Activity` weiterlädt — `null`,
   * wenn diese Seite bereits die letzte war. */
  nextCursor: string | null;
}

/**
 * Das Aktivitäts-Protokoll eines Projekts.
 *
 * Ohne `audit.view` bekommt die Person nicht nichts, sondern einen
 * gefilterten Ausschnitt — was sie selbst getan hat oder was ihr passiert ist
 * (`selfOnly` in `lib/audit/index.ts`). Der Ausschnitt ist damit dieselbe
 * Abfrage für alle, nur mit einem zusätzlichen Filter, kein zweiter Pfad.
 */
export const getProjectActivity = cache(
  async (
    projectId: string,
    limit: number = ACTIVITY_PAGE_SIZE,
  ): Promise<ActivityView> => {
    const userId = await currentUserId();
    if (!userId) return { entries: [], canViewAll: false, nextCursor: null };

    const access = await accessFor(userId, { projectId });
    const canViewAll = access.has("audit.view");

    const entries = await listAudit({
      projectId,
      limit,
      ...(canViewAll ? {} : { selfOnly: userId }),
    });

    return {
      entries,
      canViewAll,
      nextCursor:
        entries.length === limit ? entries[entries.length - 1].id : null,
    };
  },
);

/** Spiegelbild von `getProjectActivity` auf Workspace-Ebene. */
export const getWorkspaceActivity = cache(
  async (
    workspaceId: string,
    limit: number = ACTIVITY_PAGE_SIZE,
  ): Promise<ActivityView> => {
    const userId = await currentUserId();
    if (!userId) return { entries: [], canViewAll: false, nextCursor: null };

    const access = await accessFor(userId, { workspaceId });
    const canViewAll = access.has("audit.view");

    const entries = await listAudit({
      workspaceId,
      limit,
      ...(canViewAll ? {} : { selfOnly: userId }),
    });

    return {
      entries,
      canViewAll,
      nextCursor:
        entries.length === limit ? entries[entries.length - 1].id : null,
    };
  },
);
