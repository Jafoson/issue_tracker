import { notFound } from "next/navigation";
import { loadMoreWorkspaceTeams } from "@/features/workspaces/actions";
import { WorkspaceTeams } from "@/features/workspaces/components/WorkspaceTeams/WorkspaceTeams";
import { getWorkspaceTeamsView } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * Die Teams des Workspace, einen Klick von der Seitenleiste entfernt.
 *
 * Dieselbe Komponente wie unter `…/settings/teams` — geteilt wird sie, nicht
 * die Route, damit jede Adresse den Rahmen mitbringt, in den sie gehört.
 */
export default async function TeamsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const view = await getWorkspaceTeamsView();
  if (!view) notFound();

  return (
    <WorkspaceTeams
      {...view}
      workspaceId={workspace}
      loadMore={loadMoreWorkspaceTeams.bind(null, workspace)}
    />
  );
}
