import { notFound } from "next/navigation";
import { WorkspaceDashboard } from "@/features/dashboard/components/WorkspaceDashboard/WorkspaceDashboard";
import {
  getMyWorkspaceDashboardLayout,
  getWorkspaceDashboard,
} from "@/features/dashboard/queries";
import { toDashboardScope } from "@/features/dashboard/scope";
import { toRange } from "@/lib/buckets";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { workspacePath, workspaceSettingsPath } from "@/lib/nav";

export const dynamic = "force-dynamic";

/**
 * Das Dashboard des Workspace — die Zahlen über alle seine Projekte hinweg.
 * Die Gegenansicht ist die Wurzel des Workspace (`/<workspaceId>`, kein
 * `/overview`); anders als beim Projekt sind es hier zwei eigene Routen mit
 * je einem eigenen Navlink in der Seitenleiste, siehe `WorkspaceDashboard`
 * für die Begründung.
 */
export default async function WorkspaceDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ range?: string; scope?: string }>;
}) {
  const { workspace } = await params;
  const { range: rangeParam, scope: scopeParam } = await searchParams;
  setCurrentWorkspaceId(workspace);

  const stored = await getMyWorkspaceDashboardLayout(workspace);
  const range = toRange(rangeParam ?? stored.range ?? undefined);
  const scope = toDashboardScope(scopeParam, stored.scope);

  const data = await getWorkspaceDashboard(workspace, range, scope);
  if (!data) notFound();

  return (
    <WorkspaceDashboard
      {...data}
      view="dashboard"
      issueBase={`/${workspace}/issue`}
      links={{
        dashboard: workspacePath(workspace, "dashboard"),
        overview: workspacePath(workspace, ""),
        projects: workspacePath(workspace, "projects"),
        members: workspacePath(workspace, "members"),
        teams: workspacePath(workspace, "teams"),
        settings: workspaceSettingsPath(workspace, ""),
      }}
    />
  );
}
