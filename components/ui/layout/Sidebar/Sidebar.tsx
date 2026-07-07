import { NavLink } from "./components/NavLink";
import { QuickActions } from "./components/QuickActions";
import { UserMenu } from "./components/UserMenu";
import WorkspaceMenu from "./components/WorkSpaceMenu";
import styles from "./sidebar.module.scss";

interface SidebarProps{
  isAdminPage?: boolean
}

export function Sidebar({isAdminPage = false}: SidebarProps) {
  return <aside className={styles.aside}>
    <WorkspaceMenu />
    <QuickActions/>
    <NavLink href="/" label="Test" icon="lucide:shield" active/>
    <UserMenu />
  </aside>;
}
