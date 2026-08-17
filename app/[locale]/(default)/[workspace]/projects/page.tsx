import { loadMoreProjectsOverview } from "@/features/projects/actions";
import { ProjectOverview } from "@/features/projects/components/ProjectOverview/ProjectOverview";
import { getProjectsOverview } from "@/features/projects/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * Die Projekte des Workspace zum Nachschlagen — eine Liste, ein Klick hinein.
 *
 * Nicht dieselbe Ansicht wie unter `…/settings/projects`: dort wird verwaltet
 * (anlegen, ändern, löschen, getrennt nach Sichtbarkeit), hier gesucht. Anders
 * als bei den Mitgliedern, wo beide Wege dieselbe Tabelle zeigen, fallen die
 * zwei Fragen bei Projekten auseinander.
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
