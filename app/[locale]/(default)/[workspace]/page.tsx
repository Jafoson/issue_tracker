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
 * Die Übersicht des Workspace — der Steckbrief: was er ist, wer ihn trägt,
 * woraus er besteht. Sie ist die Wurzel des Workspace (`/<workspaceId>`) und
 * nicht `/<workspaceId>/overview`: anders als ein Projekt, dessen Wurzel schon
 * das Board ist, hat der Workspace keine eigene Startseite, der sie streitig
 * machen könnte.
 *
 * Kennt keinen Zeitraum und deshalb kein `?range=` in der Adresse; die Zahlen
 * dazu holt `getWorkspaceDashboard` trotzdem mit, damit ein Wechsel zum
 * Dashboard keinen zweiten Serverlauf braucht.
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
