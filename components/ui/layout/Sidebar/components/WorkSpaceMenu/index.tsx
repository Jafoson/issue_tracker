import {
  getCurrentWorkspace,
  getMyWorkspaces,
} from "@/features/workspaces/queries";
import { WorkspaceMenuClient } from "./WorkSpaceMenuClient";

async function WorkspaceMenu() {
  const [workspace, userWorkspaces] = await Promise.all([
    getCurrentWorkspace(),
    getMyWorkspaces(),
  ]);

  //TODO: add logic to handle if user is not part of any workspace

  if (!workspace) return null;

  return (
    <div>
      <WorkspaceMenuClient
        workspace={workspace}
        userWorkspaces={userWorkspaces}
      />
    </div>
  );
}

export default WorkspaceMenu;
