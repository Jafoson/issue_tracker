import { notFound } from "next/navigation";
import { loadMoreWorkspaceMembers } from "@/features/workspaces/actions";
import { WorkspaceMembers } from "@/features/workspaces/components/WorkspaceMembers/WorkspaceMembers";
import { getWorkspaceMembersView } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * The workspace's members — here within the settings frame.
 *
 * The same view as under `/<workspace>/members`; it's the component that's
 * shared, not the route. That way each URL still brings the frame it belongs
 * in, and the query checks permissions regardless.
 */
export default async function WorkspaceSettingsMembersPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const view = await getWorkspaceMembersView();
  if (!view) notFound();

  return (
    <WorkspaceMembers
      {...view}
      workspaceId={workspace}
      loadMore={loadMoreWorkspaceMembers.bind(null, workspace)}
    />
  );
}
