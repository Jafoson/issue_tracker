import { loadMoreProjectsOverview } from "@/features/projects/actions";
import { ProjectOverview } from "@/features/projects/components/ProjectOverview/ProjectOverview";
import { getProjectsOverview } from "@/features/projects/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * The workspace's projects for lookup — a list, one click into each.
 *
 * Not the same view as under `…/settings/projects`: that one is for
 * management (create, edit, delete, split by visibility), this one is for
 * browsing. Unlike with members, where both paths show the same table, the
 * two concerns diverge for projects.
 */
export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const { rows, canCreate, nextCursor } = await getProjectsOverview(workspace);

  return (
    <ProjectOverview
      rows={rows}
      canCreate={canCreate}
      workspaceId={workspace}
      nextCursor={nextCursor}
      loadMore={loadMoreProjectsOverview.bind(null, workspace)}
    />
  );
}
