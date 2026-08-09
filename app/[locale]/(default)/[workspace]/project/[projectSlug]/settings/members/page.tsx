import { notFound } from "next/navigation";
import { ProjectMembers } from "@/features/projects/components/ProjectMembers/ProjectMembers";
import { getProjectMembersView } from "@/features/projects/queries";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * Die Mitglieder eines Projekts — hier im Rahmen der Einstellungen.
 *
 * Dieselbe Ansicht steht unter `…/project/<slug>/members`, also einen Klick vom
 * Board entfernt. Beide Wege sind gewollt: wer im Projekt arbeitet, sucht die
 * Leute beim Projekt, wer es einrichtet, sucht sie in den Einstellungen neben
 * Rollen und Labels. Geteilt wird die Komponente, nicht die Route — dadurch
 * bringt jede Adresse den Rahmen mit, in den sie gehört (hier die Leiste der
 * Einstellungen), und die Rechte prüft ohnehin die Abfrage.
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
    />
  );
}
