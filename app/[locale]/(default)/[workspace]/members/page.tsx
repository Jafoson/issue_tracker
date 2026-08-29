import { notFound } from "next/navigation";
import { loadMoreWorkspaceMembers } from "@/features/workspaces/actions";
import { WorkspaceMembers } from "@/features/workspaces/components/WorkspaceMembers/WorkspaceMembers";
import { getWorkspaceMembersView } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * The workspace's members, one click away from the sidebar.
 *
 * The same component as under `…/settings/members` — anyone working in the
 * workspace looks here to see who they can reach out to; anyone setting it
 * up finds the same list in settings next to roles and teams.
 */
export default async function MembersPage({
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
