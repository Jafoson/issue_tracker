import { notFound } from "next/navigation";
import { WorkspaceTeams } from "@/features/workspaces/components/WorkspaceTeams/WorkspaceTeams";
import { getWorkspaceTeamsView } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * Die Teams des Workspace — hier im Rahmen der Einstellungen.
 *
 * Dieselbe Ansicht steht unter `/<workspace>/teams`, einen Klick von der
 * Seitenleiste entfernt. Beide Wege sind gewollt: wer im Workspace arbeitet,
 * sucht die Gruppen direkt, wer ihn einrichtet, sucht sie neben Rollen und
 * Labels.
 */
export default async function WorkspaceSettingsTeamsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const view = await getWorkspaceTeamsView();
  if (!view) notFound();

  return <WorkspaceTeams {...view} workspaceId={workspace} />;
}
