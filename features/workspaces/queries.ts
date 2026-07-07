import "server-only";
import { cache } from "react";
import { getUserWorkspaces, getWorkspace } from "@/features/issues/queries";
import { getCurrentWorkspaceId } from "@/lib/current-workspace";
import { getSession } from "@/lib/session";
import type { Workspace } from "@/lib/workspace-context";

// Server-Functions als Ersatz für den `useWorkspace()`-Client-Context in Server
// Components — dasselbe Muster wie `getSession()`: kein Prop-Drilling, kein
// Provider nötig, direkt serverseitig aufrufbar.

/** Aktueller Workspace (aus dem Request-Store). Analog zu `getSession()`. */
export const getCurrentWorkspace = cache(
  async (): Promise<Workspace | null> => {
    const id = getCurrentWorkspaceId();
    return id ? getWorkspace(id) : null;
  },
);

/** Alle Workspaces des eingeloggten Users. */
export const getMyWorkspaces = cache(async (): Promise<Workspace[]> => {
  const session = await getSession();
  return session ? getUserWorkspaces(session.userId) : [];
});
