import "server-only";
import { cache } from "react";
import { listAudit } from "@/lib/audit";
import type { AuditEntry } from "@/lib/audit/actions";
import { accessFor, currentUserId } from "@/lib/permissions";

export interface ActivityView {
  entries: AuditEntry[];
  /** Ob die volle, ungefilterte Liste zu sehen war — steuert z. B. Hinweise
   * in der Oberfläche, dass nur eigene Einträge gezeigt werden. */
  canViewAll: boolean;
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
  async (projectId: string, limit?: number): Promise<ActivityView> => {
    const userId = await currentUserId();
    if (!userId) return { entries: [], canViewAll: false };

    const access = await accessFor(userId, { projectId });
    const canViewAll = access.has("audit.view");

    const entries = await listAudit({
      projectId,
      limit,
      ...(canViewAll ? {} : { selfOnly: userId }),
    });

    return { entries, canViewAll };
  },
);

/** Spiegelbild von `getProjectActivity` auf Workspace-Ebene. */
export const getWorkspaceActivity = cache(
  async (workspaceId: string, limit?: number): Promise<ActivityView> => {
    const userId = await currentUserId();
    if (!userId) return { entries: [], canViewAll: false };

    const access = await accessFor(userId, { workspaceId });
    const canViewAll = access.has("audit.view");

    const entries = await listAudit({
      workspaceId,
      limit,
      ...(canViewAll ? {} : { selfOnly: userId }),
    });

    return { entries, canViewAll };
  },
);
