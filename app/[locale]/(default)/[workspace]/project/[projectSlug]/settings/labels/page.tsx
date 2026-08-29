import { notFound } from "next/navigation";
import {
  loadMoreProjectInheritedLabels,
  loadMoreProjectLabels,
} from "@/features/projects/actions";
import { ProjectLabels } from "@/features/projects/components/ProjectLabels/ProjectLabels";
import { getProjectLabelsView } from "@/features/projects/queries";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * A project's labels — create, rename, recolor, delete.
 *
 * What the workspace provides is included in the list, but only for
 * reference: `getProjectLabelsView` resolves the `label.*` permissions in
 * the project scope, and that isn't sufficient for a workspace-wide label.
 */
export default async function ProjectLabelsPage({
  params,
}: {
  params: Promise<{ workspace: string; projectSlug: string }>;
}) {
  const { workspace, projectSlug } = await params;
  setCurrentWorkspaceId(workspace);

  const projects = await getWorkspaceProjects();
  const project = projects.find((p) => p.slug === projectSlug);
  if (!project) notFound();

  const view = await getProjectLabelsView(project.id);
  if (!view) notFound();

  return (
    <ProjectLabels
      projectId={project.id}
      projectName={project.name}
      workspaceId={workspace}
      {...view}
      loadMoreOwn={loadMoreProjectLabels.bind(null, project.id)}
      loadMoreInherited={loadMoreProjectInheritedLabels.bind(null, project.id)}
    />
  );
}
