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
 * Die Labels des Workspace — anlegen, umbenennen, umfärben, löschen.
 *
 * Was einzelnen Projekten gehört, steht mit in der Liste, aber nur zum
 * Nachsehen: `getWorkspaceLabelsView` löst die `label.*`-Rechte im
 * Workspace-Scope auf, und der reicht für ein Projekt-Label nicht.
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
