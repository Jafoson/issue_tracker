import "server-only";
import { cache } from "react";
import type {
  IssueComposerData,
  IssueEditorData,
} from "@/features/issues/types";
import {
  getCurrentWorkspace,
  getMe,
  getWorkspaceIssueTypes,
  getWorkspaceLabels,
  getWorkspaceMembers,
  getWorkspacePriorities,
  getWorkspaceProjects,
  getWorkspaceSearchIssues,
  getWorkspaceStatuses,
} from "@/features/workspaces/queries";

// Eigene Datei statt `queries.ts`: `features/workspaces/queries` importiert von
// dort, ein Aufruf in die Gegenrichtung wäre ein Zyklus.
//
// Beides über `cache()` — Board-Page und Sidebar holen dasselbe Bündel im
// selben Request und teilen sich die Abfragen.

/** Workspace-Daten für eine Issue-Bearbeitungsoberfläche (z.B. `IssueDetail`). */
export const getIssueEditorData = cache(
  async (): Promise<IssueEditorData | null> => {
    const [
      workspace,
      me,
      projects,
      members,
      labels,
      statuses,
      priorities,
      searchIssues,
    ] = await Promise.all([
      getCurrentWorkspace(),
      getMe(),
      getWorkspaceProjects(),
      getWorkspaceMembers(),
      getWorkspaceLabels(),
      getWorkspaceStatuses(),
      getWorkspacePriorities(),
      // Für den `#`-Trigger. Dieselbe Abfrage nutzt die CommandPalette, und
      // beide teilen sie sich über `cache()` im selben Request.
      getWorkspaceSearchIssues(),
    ]);

    if (!workspace || !me) return null;
    return {
      workspaceId: workspace.id,
      me,
      projects,
      members,
      labels,
      statuses,
      priorities,
      searchIssues,
    };
  },
);

/** Wie `getIssueEditorData`, plus die Issue-Typen für den Composer. */
export const getIssueComposerData = cache(
  async (): Promise<IssueComposerData | null> => {
    const [editor, issueTypes] = await Promise.all([
      getIssueEditorData(),
      getWorkspaceIssueTypes(),
    ]);
    return editor ? { ...editor, issueTypes } : null;
  },
);
