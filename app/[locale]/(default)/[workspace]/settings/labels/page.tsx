import { notFound } from "next/navigation";
import {
  loadMoreWorkspaceLabels,
  loadMoreWorkspaceProjectLabels,
} from "@/features/workspaces/actions";
import { WorkspaceLabels } from "@/features/workspaces/components/WorkspaceLabels/WorkspaceLabels";
import { getWorkspaceLabelsView } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * The workspace's labels — create, rename, recolor, delete.
 *
 * What belongs to individual projects is included in the list, but only for
 * reference: `getWorkspaceLabelsView` resolves the `label.*` permissions in
 * the workspace scope, and that isn't sufficient for a project label.
 */
export default async function WorkspaceLabelsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const view = await getWorkspaceLabelsView();
  if (!view) notFound();

  return (
    <WorkspaceLabels
      {...view}
      workspaceId={workspace}
      loadMoreOwn={loadMoreWorkspaceLabels.bind(null, workspace)}
      loadMoreFromProjects={loadMoreWorkspaceProjectLabels.bind(
        null,
        workspace,
      )}
    />
  );
}
