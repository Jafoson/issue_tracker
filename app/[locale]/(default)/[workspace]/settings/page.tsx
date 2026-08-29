import { notFound } from "next/navigation";
import { WorkspaceSettings } from "@/features/workspaces/components/WorkspaceSettings/WorkspaceSettings";
import { getWorkspaceSettingsView } from "@/features/workspaces/queries";
import { appUrl } from "@/lib/app-url";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { workspacePath } from "@/lib/nav";

export const dynamic = "force-dynamic";

/**
 * The workspace's core data, its stats, and deletion.
 *
 * Checked in `getWorkspaceSettingsView` and again in the actions — `null`
 * means, here as everywhere, "doesn't exist for you".
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
      // Absolute, not a path: the URL gets copied and pasted elsewhere.
      // It's assembled here because only the server knows which host the app
      // runs under (`AUTH_URL`).
      workspaceUrl={appUrl(workspacePath(workspace, ""))}
    />
  );
}
