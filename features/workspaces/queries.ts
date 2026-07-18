import "server-only";
import { cache } from "react";
import {
  getGlobalRole as getGlobalRoleById,
  getIssueTypes,
  getLabels,
  getMembers,
  getPriorities,
  getProjects,
  getRoles,
  getSearchIssues,
  getStatuses,
  getUserWorkspaces,
  getWorkspace,
} from "@/features/issues/queries";
import { getCurrentWorkspaceId } from "@/lib/current-workspace";
import { getSession } from "@/lib/session";
import type {
  IssueType,
  Label,
  Priority,
  Project,
  Role,
  SearchableIssue,
  Status,
  User,
  Workspace,
} from "@/types";

// Serverseitiger Ersatz für den früheren `useWorkspace()`-Client-Context —
// dasselbe Muster wie `getSession()`: kein Prop-Drilling, kein Provider nötig,
// direkt aus jeder Server Component aufrufbar. Die aktive Workspace-ID kommt aus
// dem Request-Store (`lib/current-workspace.ts`), den das App-Layout seedet.
//
// Alle Funktionen sind über `cache()` pro Request dedupliziert — mehrfache
// Aufrufe aus verschiedenen Komponenten kosten nur eine DB-Abfrage.

/** Aktive Workspace-ID, oder Fehler außerhalb der Workspace-Shell (z.B. /admin). */
function requireWorkspaceId(): string {
  const id = getCurrentWorkspaceId();
  if (!id) {
    throw new Error(
      "Kein aktiver Workspace im Request — diese Query ist nur innerhalb der Workspace-Shell nutzbar.",
    );
  }
  return id;
}

/** Aktueller Workspace, oder `null` außerhalb der Workspace-Shell. Analog zu `getSession()`. */
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

/** Der eingeloggte User als Mitglied des aktiven Workspace. */
export const getMe = cache(async (): Promise<User | null> => {
  const session = await getSession();
  if (!session) return null;
  const members = await getWorkspaceMembers();
  return members.find((m) => m.id === session.userId) ?? null;
});

/**
 * Globale Plattform-Rolle des eingeloggten Users ("admin" | "member") — steuert
 * den Zugang zum /admin-Bereich. Bezieht sich nur auf den eigenen User, nicht
 * auf die Workspace-Mitglieder.
 */
export const getMyGlobalRole = cache(async (): Promise<string> => {
  const session = await getSession();
  return session ? getGlobalRoleById(session.userId) : "member";
});

export const getWorkspaceMembers = cache(
  async (): Promise<User[]> => getMembers(requireWorkspaceId()),
);

export const getWorkspaceProjects = cache(
  async (): Promise<Project[]> => getProjects(requireWorkspaceId()),
);

export const getWorkspaceLabels = cache(
  async (): Promise<Label[]> => getLabels(requireWorkspaceId()),
);

export const getWorkspaceStatuses = cache(
  async (): Promise<Status[]> => getStatuses(requireWorkspaceId()),
);

export const getWorkspacePriorities = cache(
  async (): Promise<Priority[]> => getPriorities(requireWorkspaceId()),
);

export const getWorkspaceIssueTypes = cache(
  async (): Promise<IssueType[]> => getIssueTypes(requireWorkspaceId()),
);

export const getWorkspaceRoles = cache(
  async (): Promise<Role[]> => getRoles(requireWorkspaceId()),
);

export const getWorkspaceSearchIssues = cache(
  async (): Promise<SearchableIssue[]> => getSearchIssues(requireWorkspaceId()),
);
