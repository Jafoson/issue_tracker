import BackToWorkspaceClient from "./BackToWorkspace";
import WorkspaceMenu from "./WorkSpaceMenu";

async function SidebarMenu({ isAdminRoute }: { isAdminRoute: boolean }) {
  function MenuSwitch() {
    if (isAdminRoute) {
      return <BackToWorkspaceClient />;
    }
    return <WorkspaceMenu />;
  }
  return <MenuSwitch />;
}

export default SidebarMenu;
