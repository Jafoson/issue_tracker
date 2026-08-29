import { notFound } from "next/navigation";
import { loadMoreWorkspaceTeams } from "@/features/workspaces/actions";
import { WorkspaceTeams } from "@/features/workspaces/components/WorkspaceTeams/WorkspaceTeams";
import { getWorkspaceTeamsView } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * The workspace's teams — here within the settings frame.
 *
 * The same view is available under `/<workspace>/teams`, one click away from
 * the sidebar. Both paths are intentional: anyone working in the workspace
 * looks for the groups directly, anyone setting it up looks for them next to
 * roles and labels.
 */
export default async function WorkspaceSettingsTeamsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const view = await getWorkspaceTeamsView();
  if (!view) notFound();

  return (
    <WorkspaceTeams
      {...view}
      workspaceId={workspace}
      loadMore={loadMoreWorkspaceTeams.bind(null, workspace)}
    />
  );
}
