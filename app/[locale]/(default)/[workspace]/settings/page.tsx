import { notFound } from "next/navigation";
import { WorkspaceSettings } from "@/features/workspaces/components/WorkspaceSettings/WorkspaceSettings";
import { getWorkspaceSettingsView } from "@/features/workspaces/queries";
import { appUrl } from "@/lib/app-url";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { workspacePath } from "@/lib/nav";

export const dynamic = "force-dynamic";

/**
 * Stammdaten des Workspace, seine Zahlen und das Löschen.
 *
 * Geprüft wird in `getWorkspaceSettingsView` und noch einmal in den Actions —
 * `null` heißt hier wie überall „gibt es für dich nicht".
 */
export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const view = await getWorkspaceSettingsView();
  if (!view) notFound();

  return (
    <WorkspaceSettings
      {...view}
      // Absolut, nicht als Pfad: die Adresse wird kopiert und woanders
      // eingefügt. Zusammengesetzt wird sie hier, weil nur der Server weiß,
      // unter welchem Host die App läuft (`AUTH_URL`).
      workspaceUrl={appUrl(workspacePath(workspace, ""))}
    />
  );
}
