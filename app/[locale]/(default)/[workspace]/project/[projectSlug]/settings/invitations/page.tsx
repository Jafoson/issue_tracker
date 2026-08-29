import { notFound } from "next/navigation";
import {
  createProjectInviteLink,
  loadMorePendingProjectInvitations,
} from "@/features/projects/actions";
import {
  getPendingProjectInvitationsView,
  getProjectInviteLinkView,
} from "@/features/projects/queries";
import { InviteLinkPanel } from "@/features/workspaces/components/InviteLinkPanel/InviteLinkPanel";
import { PendingInvitations } from "@/features/workspaces/components/PendingInvitations/PendingInvitations";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * How people get into the project: the shareable link on top, open email
 * invitations (guests included) below. The same pair of components as at
 * the workspace level, just fed with the project-scoped queries.
 */
export default async function ProjectSettingsInvitationsPage({
  params,
}: {
  params: Promise<{ workspace: string; projectSlug: string }>;
}) {
  const { workspace, projectSlug } = await params;
  setCurrentWorkspaceId(workspace);

  const projects = await getWorkspaceProjects();
  const project = projects.find((p) => p.slug === projectSlug);
  if (!project) notFound();

  const [view, linkView] = await Promise.all([
    getPendingProjectInvitationsView(project.id),
    getProjectInviteLinkView(project.id),
  ]);
  if (!view || !linkView) notFound();

  return (
    <>
      <InviteLinkPanel
        {...linkView}
        create={createProjectInviteLink.bind(null, project.id)}
      />
      <PendingInvitations
        {...view}
        loadMore={loadMorePendingProjectInvitations.bind(null, project.id)}
      />
    </>
  );
}
