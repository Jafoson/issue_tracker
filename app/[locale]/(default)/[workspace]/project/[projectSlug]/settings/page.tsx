import { notFound } from "next/navigation";
import { ProjectSettings } from "@/features/projects/components/ProjectSettings/ProjectSettings";
import { getProjectSettingsView } from "@/features/projects/queries";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { appUrl } from "@/lib/app-url";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { projectPath } from "@/lib/nav";

export const dynamic = "force-dynamic";

/**
 * Stammdaten, Sichtbarkeit und Löschen eines Projekts.
 *
 * Die Seite war in `PROJECT_NAV` schon verlinkt, bevor es sie gab. Sie ist der
 * Ort, an dem `project.update` und `project.delete` überhaupt erst etwas
 * bedeuten — geprüft wird beides in `getProjectSettingsView` und noch einmal in
 * den Actions.
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
      // Absolut, nicht als Pfad: die Adresse wird kopiert und woanders
      // eingefügt. Zusammengesetzt wird sie hier, weil nur der Server weiß,
      // unter welchem Host die App läuft (`AUTH_URL`).
      projectUrl={appUrl(projectPath(workspace, project.slug, ""))}
    />
  );
}
