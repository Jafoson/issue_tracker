import { notFound } from "next/navigation";
import { ProjectSettings } from "@/features/projects/components/ProjectSettings/ProjectSettings";
import { getProjectSettingsView } from "@/features/projects/queries";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { appUrl } from "@/lib/app-url";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { projectPath } from "@/lib/nav";

export const dynamic = "force-dynamic";

/**
 * Core data, visibility, and deletion of a project.
 *
 * This page was already linked in `PROJECT_NAV` before it existed. It's the
 * place where `project.update` and `project.delete` first mean anything at
 * all — both are checked in `getProjectSettingsView` and again in the
 * actions.
 */
export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ workspace: string; projectSlug: string }>;
}) {
  const { workspace, projectSlug } = await params;
  setCurrentWorkspaceId(workspace);

  const projects = await getWorkspaceProjects();
  const project = projects.find((p) => p.slug === projectSlug);
  if (!project) notFound();

  const view = await getProjectSettingsView(project.id);
  if (!view) notFound();

  return (
    <ProjectSettings
      {...view}
      workspaceId={workspace}
      // Absolute, not a path: the URL gets copied and pasted elsewhere.
      // It's assembled here because only the server knows which host the app
      // runs under (`AUTH_URL`).
      projectUrl={appUrl(projectPath(workspace, project.slug, ""))}
    />
  );
}
