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
 * Die Projekte des Workspace — anlegen, ändern, löschen.
 *
 * Gelistet ist, was der Handelnde sehen darf; was er damit tun darf, steht an
 * jeder Zeile einzeln (`getWorkspaceProjectsView`). `project.update` und
 * `project.delete` gelten im Projekt, nicht im Workspace.
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
