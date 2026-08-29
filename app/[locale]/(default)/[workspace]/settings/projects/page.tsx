import { notFound } from "next/navigation";
import {
  loadMorePrivateWorkspaceProjects,
  loadMorePublicWorkspaceProjects,
  loadMoreWorkspaceProjects,
} from "@/features/workspaces/actions";
import { WorkspaceProjects } from "@/features/workspaces/components/WorkspaceProjects/WorkspaceProjects";
import { getWorkspaceProjectsView } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * The workspace's projects — create, edit, delete.
 *
 * What's listed is what the actor is allowed to see; what they're allowed to
 * do with it is decided per row (`getWorkspaceProjectsView`). `project.update`
 * and `project.delete` apply within the project, not the workspace.
 */
export default async function WorkspaceProjectsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const view = await getWorkspaceProjectsView();
  if (!view) notFound();

  return (
    <WorkspaceProjects
      {...view}
      workspaceId={workspace}
      loadMore={loadMoreWorkspaceProjects.bind(null, workspace)}
      loadMorePublic={loadMorePublicWorkspaceProjects.bind(null, workspace)}
      loadMorePrivate={loadMorePrivateWorkspaceProjects.bind(null, workspace)}
    />
  );
}
