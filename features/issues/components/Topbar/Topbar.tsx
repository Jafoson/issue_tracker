import { Suspense } from "react";
import {
  getCurrentWorkspace,
  getWorkspaceLabels,
  getWorkspaceMembers,
  getWorkspacePriorities,
  getWorkspaceProjects,
  getWorkspaceStatuses,
} from "@/features/workspaces/queries";
import { TopbarClient } from "./TopbarClient";

interface TopbarProps {
  /** Issues in the current view — already narrowed by the active filters. */
  count: number;
}

/** Title, issue count, search, filter/sort/view bar above the board and list. */
export async function Topbar({ count }: TopbarProps) {
  const [workspace, projects, statuses, priorities, members, labels] =
    await Promise.all([
      getCurrentWorkspace(),
      getWorkspaceProjects(),
      getWorkspaceStatuses(),
      getWorkspacePriorities(),
      getWorkspaceMembers(),
      getWorkspaceLabels(),
    ]);

  if (!workspace) return null;

  return (
    <Suspense>
      <TopbarClient
        count={count}
        workspaceId={workspace.id}
        projects={projects}
        statuses={statuses}
        priorities={priorities}
        members={members}
        labels={labels}
      />
    </Suspense>
  );
}
