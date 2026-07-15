import NavGroup from "./components/NavGroups";
import { QuickActions } from "./components/QuickActions";
import { UserMenu } from "./components/UserMenu";
import WorkspaceMenu from "./components/WorkSpaceMenu";
import styles from "./sidebar.module.scss";

interface SidebarProps{
  isAdminRoute?: boolean
}

export function Sidebar({isAdminRoute = false}: SidebarProps) {
  return <aside className={styles.aside}>
    <WorkspaceMenu />
    <QuickActions/>
    <NavGroup isAdminRoute={isAdminRoute}/>
    <UserMenu />
  </aside>;
}
