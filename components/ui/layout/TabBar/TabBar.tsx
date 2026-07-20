import {
  getCurrentWorkspace,
  getWorkspaceProjects,
} from "@/features/workspaces/queries";
import { TabBarClient } from "./TabBarClient";

// Server Component: bestimmt den Tab-Kontext und reicht ihn an die Client-Logik.
// - Admin-Bereich: eigener Namespace + `/admin`-Routen, kein Workspace nötig.
// - Workspace-Shell: Workspace + Projekte serverseitig laden. Ohne aktiven
//   Workspace (sollte hier nicht vorkommen) wird nichts gerendert.
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
      defaultHref={`/my`}
      projects={projects}
      currentWorkspaceId={workspace.id}
    />
  );
}
