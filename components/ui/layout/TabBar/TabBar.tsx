import {
  getCurrentWorkspace,
  getWorkspaceProjects,
} from "@/features/workspaces/queries";
import { TabBarClient } from "./TabBarClient";

// Server Component: determines the tab context and hands it to the client logic.
// - Admin area: its own namespace + `/admin` routes, no workspace needed.
// - Workspace shell: load workspace + projects server-side. Without an
//   active workspace (shouldn't happen here), nothing is rendered.
export async function TabBar({
  isAdminRoute = false,
}: {
  isAdminRoute?: boolean;
}) {
  if (isAdminRoute) {
    return (
      <TabBarClient
        defaultHref="/admin"
        projects={[]}
        currentWorkspaceId={null}
      />
    );
  }

  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  const projects = await getWorkspaceProjects();

  return (
    <TabBarClient
      defaultHref={`/${workspace.id}/my`}
      projects={projects}
      currentWorkspaceId={workspace.id}
    />
  );
}
