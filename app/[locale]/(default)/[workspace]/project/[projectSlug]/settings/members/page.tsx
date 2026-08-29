import { notFound } from "next/navigation";
import { loadMoreProjectMembers } from "@/features/projects/actions";
import { ProjectMembers } from "@/features/projects/components/ProjectMembers/ProjectMembers";
import { getProjectMembersView } from "@/features/projects/queries";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * A project's members — here within the settings frame.
 *
 * The same view is available under `…/project/<slug>/members`, one click
 * away from the board. Both paths are intentional: anyone working in the
 * project looks for people at the project, anyone setting it up looks for
 * them in settings next to roles and labels. It's the component that's
 * shared, not the route — that way each URL still brings the frame it
 * belongs in (here, the settings sidebar), and the query checks permissions
 * regardless.
 */
export default async function ProjectSettingsMembersPage({
  params,
}: {
  params: Promise<{ workspace: string; projectSlug: string }>;
}) {
  const { workspace, projectSlug } = await params;
  setCurrentWorkspaceId(workspace);

  const projects = await getWorkspaceProjects();
  const project = projects.find((p) => p.slug === projectSlug);
  if (!project) notFound();

  const view = await getProjectMembersView(project.id);
  if (!view) notFound();

  return (
    <ProjectMembers
      projectId={project.id}
      projectName={project.name}
      {...view}
      loadMore={loadMoreProjectMembers.bind(null, project.id)}
    />
  );
}
