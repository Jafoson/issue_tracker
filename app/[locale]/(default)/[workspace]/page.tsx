import { notFound } from "next/navigation";
import { ACTIVITY_OVERVIEW_LIMIT } from "@/features/audit/constants";
import { getWorkspaceActivity } from "@/features/audit/queries";
import { WorkspaceDashboard } from "@/features/dashboard/components/WorkspaceDashboard/WorkspaceDashboard";
import {
  getMyWorkspaceDashboardLayout,
  getWorkspaceDashboard,
} from "@/features/dashboard/queries";
import { toRange } from "@/lib/buckets";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { workspacePath, workspaceSettingsPath } from "@/lib/nav";

export const dynamic = "force-dynamic";

/**
 * The workspace overview — its profile: what it is, who runs it, what it's
 * made of. It's the workspace root (`/<workspaceId>`) and not
 * `/<workspaceId>/overview`: unlike a project, whose root is already the
 * board, the workspace has no dedicated landing page competing for that spot.
 *
 * Has no time range and therefore no `?range=` in the URL; `getWorkspaceDashboard`
 * still fetches the numbers for it, so switching to the dashboard doesn't need
 * a second server round-trip.
 */
export default async function WorkspaceOverviewPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const stored = await getMyWorkspaceDashboardLayout(workspace);
  const range = toRange(stored.range ?? undefined);

  const data = await getWorkspaceDashboard(workspace, range);
  if (!data) notFound();

  const activity = await getWorkspaceActivity(
    workspace,
    ACTIVITY_OVERVIEW_LIMIT,
  );

  return (
    <WorkspaceDashboard
      {...data}
      view="profile"
      issueBase={`/${workspace}/issue`}
      links={{
        dashboard: workspacePath(workspace, "dashboard"),
        overview: workspacePath(workspace, ""),
        projects: workspacePath(workspace, "projects"),
        members: workspacePath(workspace, "members"),
        teams: workspacePath(workspace, "teams"),
        settings: workspaceSettingsPath(workspace, ""),
        activity: workspaceSettingsPath(workspace, "activity"),
      }}
      activity={activity}
    />
  );
}
