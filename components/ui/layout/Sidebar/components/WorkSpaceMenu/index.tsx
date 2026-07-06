import { useWorkspace } from "@/lib/workspace-context";
import { WorkspaceMenuClient } from "./WorkSpaceMenuClient";


const { workspace, userWorkspaces } = useWorkspace();

function WorkspaceMenu() {
  return (
    <div>
        <WorkspaceMenuClient workspace={workspace} userWorkspaces={userWorkspaces} />
    </div>
  )
}

export default WorkspaceMenu