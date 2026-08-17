import { notFound } from "next/navigation";
import { loadMoreWorkspaceMembers } from "@/features/workspaces/actions";
import { WorkspaceMembers } from "@/features/workspaces/components/WorkspaceMembers/WorkspaceMembers";
import { getWorkspaceMembersView } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * Die Mitglieder des Workspace, einen Klick von der Seitenleiste entfernt.
 *
 * Dieselbe Komponente wie unter `…/settings/members` — wer im Workspace
 * arbeitet, schlägt hier nach, wen er ansprechen kann; wer ihn einrichtet,
 * findet dieselbe Liste in den Einstellungen neben Rollen und Teams.
 */
export default async function MembersPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const view = await getWorkspaceMembersView();
  if (!view) notFound();

  return (
    <WorkspaceMembers
      {...view}
      workspaceId={workspace}
      loadMore={loadMoreWorkspaceMembers.bind(null, workspace)}
    />
  );
}
