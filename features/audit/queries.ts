import "server-only";
import { cache } from "react";
import { ACTIVITY_PAGE_SIZE } from "@/features/audit/constants";
import { listAudit } from "@/lib/audit";
import type { AuditEntry } from "@/lib/audit/actions";
import { accessFor, currentUserId } from "@/lib/permissions";

export interface ActivityView {
  entries: AuditEntry[];
  /** Whether the full, unfiltered list was visible — controls, e.g.,
   * notices in the UI that only your own entries are being shown. */
  canViewAll: boolean;
  /** Id of the last entry that `loadMore*Activity` continues from —
   * `null` if this page was already the last one. */
  nextCursor: string | null;
}

/**
 * A project's activity log.
 *
 * Without `audit.view`, a person doesn't get nothing, but a filtered subset
 * — what they themselves did or what happened to them (`selfOnly` in
 * `lib/audit/index.ts`). The subset is thus the same query for everyone,
 * just with an extra filter, not a second code path.
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

/** Mirror image of `getProjectActivity` at the workspace level. */
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
