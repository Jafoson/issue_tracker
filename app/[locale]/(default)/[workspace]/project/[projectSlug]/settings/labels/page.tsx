import { notFound } from "next/navigation";
import { ProjectLabels } from "@/features/projects/components/ProjectLabels/ProjectLabels";
import { getProjectLabelsView } from "@/features/projects/queries";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * Die Labels eines Projekts — anlegen, umbenennen, umfärben, löschen.
 *
 * Was der Workspace vorgibt, steht mit in der Liste, aber nur zum Nachsehen:
 * `getProjectLabelsView` löst die `label.*`-Rechte im Projekt-Scope auf, und
 * der reicht für ein workspaceweites Label nicht.
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
    />
  );
}
