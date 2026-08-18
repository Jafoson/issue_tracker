import { notFound } from "next/navigation";
import {
  createWorkspaceInviteLink,
  loadMorePendingWorkspaceInvitations,
} from "@/features/workspaces/actions";
import { InviteLinkPanel } from "@/features/workspaces/components/InviteLinkPanel/InviteLinkPanel";
import { PendingInvitations } from "@/features/workspaces/components/PendingInvitations/PendingInvitations";
import {
  getPendingWorkspaceInvitationsView,
  getWorkspaceInviteLinkView,
} from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * Wie Leute in den Workspace kommen: der teilbare Link oben, offene
 * E-Mail-Einladungen darunter.
 */
export default async function WorkspaceSettingsInvitationsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const [view, linkView] = await Promise.all([
    getPendingWorkspaceInvitationsView(),
    getWorkspaceInviteLinkView(),
  ]);
  if (!view || !linkView) notFound();

  return (
    <>
      <InviteLinkPanel
        {...linkView}
        create={createWorkspaceInviteLink.bind(null, workspace)}
      />
      <PendingInvitations
        {...view}
        loadMore={loadMorePendingWorkspaceInvitations.bind(null, workspace)}
      />
    </>
  );
}
