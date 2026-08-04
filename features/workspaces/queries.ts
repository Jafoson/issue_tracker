import "server-only";
import { cache } from "react";
import {
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
import { db } from "@/lib/db";
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

/**
 * Der eingeloggte User als Mitglied des aktiven Workspace.
 *
 * Der Regelfall ist die Zeile aus der Mitgliederliste — sie bringt Rolle und Rang
 * mit. Wer nicht darin steht, ist damit aber nicht niemand: ein Projekt-Gast ist
 * zu genau einem Projekt eingeladen und hat keine Workspace-Mitgliedschaft. Für
 * ihn kommen die Angaben direkt aus seinem Konto, ohne Rolle.
 *
 * Ohne diesen zweiten Weg wäre `getMe()` für Gäste `null` — und weil die
 * Issue-Oberfläche daran hängt (`getIssueComposerData`), liefen sie überall in ein
 * 404, obwohl ihr Zugriff auf das Projekt in Ordnung ist.
 */
export const getMe = cache(async (): Promise<User | null> => {
  const session = await getSession();
  if (!session) return null;

  const members = await getWorkspaceMembers();
  const member = members.find((m) => m.id === session.userId);
  if (member) return member;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      handle: true,
      email: true,
      color: true,
      image: true,
    },
  });
  if (!user) return null;

  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    handle: user.handle,
    email: user.email,
    color: user.color,
    ...(user.image ? { image: user.image } : {}),
  };
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
