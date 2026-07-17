import WorkspaceMenu from "./WorkSpaceMenu";
import BackToWorkspaceClient from "./BackToWorkspace";

async function SidebarMenu({isAdminRoute}: {isAdminRoute: boolean}) {
  function MenuSwitch (){
    if (isAdminRoute){
      return <BackToWorkspaceClient/>
    }
    return <WorkspaceMenu/>
  }
  return <MenuSwitch/>

}

export default SidebarMenu;
