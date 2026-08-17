import { notFound } from "next/navigation";
import { loadMoreWorkspaceMembers } from "@/features/workspaces/actions";
import { WorkspaceMembers } from "@/features/workspaces/components/WorkspaceMembers/WorkspaceMembers";
import { getWorkspaceMembersView } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * Die Mitglieder des Workspace — hier im Rahmen der Einstellungen.
 *
 * Dieselbe Ansicht wie unter `/<workspace>/members`; geteilt wird die
 * Komponente, nicht die Route. Dadurch bringt jede Adresse den Rahmen mit, in
 * den sie gehört, und die Rechte prüft ohnehin die Abfrage.
 */
export default async function WorkspaceSettingsMembersPage({
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
