import { notFound } from "next/navigation";
import { loadMoreWorkspaceTeams } from "@/features/workspaces/actions";
import { WorkspaceTeams } from "@/features/workspaces/components/WorkspaceTeams/WorkspaceTeams";
import { getWorkspaceTeamsView } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * The workspace's teams, one click away from the sidebar.
 *
 * The same component as under `…/settings/teams` — it's the component that's
 * shared, not the route, so each URL still brings the frame it belongs in.
 */
export default async function TeamsPage({
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
