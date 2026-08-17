"use server";

import { ACTIVITY_PAGE_SIZE } from "@/features/audit/constants";
import { listAudit } from "@/lib/audit";
import type { AuditEntry } from "@/lib/audit/actions";
import { accessFor, currentUserId } from "@/lib/permissions";

export interface ActivityPage {
  entries: AuditEntry[];
  nextCursor: string | null;
}

/**
 * Eine weitere Seite fürs Infinite Scroll in `AuditLog`. Eigene Funktion statt
 * Wiederverwendung von `getWorkspaceActivity`/`getProjectActivity`: die Prüfung
 * steht hier noch einmal, weil eine Server Function als eigener Endpunkt
 * erreichbar ist — unabhängig davon, ob die Seite, die sie als Prop reicht,
 * den Zugriff schon geprüft hat.
 */
export async function loadMoreWorkspaceActivity(
  workspaceId: string,
  cursor: string,
): Promise<ActivityPage> {
  const userId = await currentUserId();
  if (!userId) return { entries: [], nextCursor: null };

  const access = await accessFor(userId, { workspaceId });
  const entries = await listAudit({
    workspaceId,
    cursor,
    limit: ACTIVITY_PAGE_SIZE,
    ...(access.has("audit.view") ? {} : { selfOnly: userId }),
  });

  return {
    entries,
    nextCursor:
      entries.length === ACTIVITY_PAGE_SIZE
        ? entries[entries.length - 1].id
        : null,
  };
}

/** Spiegelbild von `loadMoreWorkspaceActivity` auf Projekt-Ebene. */
export async function loadMoreProjectActivity(
  projectId: string,
  cursor: string,
): Promise<ActivityPage> {
  const userId = await currentUserId();
  if (!userId) return { entries: [], nextCursor: null };

  const access = await accessFor(userId, { projectId });
  const entries = await listAudit({
    projectId,
    cursor,
    limit: ACTIVITY_PAGE_SIZE,
    ...(access.has("audit.view") ? {} : { selfOnly: userId }),
  });

  return {
    entries,
    nextCursor:
      entries.length === ACTIVITY_PAGE_SIZE
        ? entries[entries.length - 1].id
        : null,
  };
}
