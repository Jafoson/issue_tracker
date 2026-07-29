import { notFound } from "next/navigation";
import { ProjectMembers } from "@/features/projects/components/ProjectMembers/ProjectMembers";
import { getProjectMembersView } from "@/features/projects/queries";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

export default async function ProjectMembersPage({
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
    />
  );
}
