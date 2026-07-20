import NavGroup from "./components/NavGroups";
import { QuickActions } from "./components/QuickActions";
import { UserMenu } from "./components/UserMenu";
import SidebarMenu from "./components/SidebarMenu";
import styles from "./sidebar.module.scss";

interface SidebarProps {
  isAdminRoute?: boolean;
}

export function Sidebar({ isAdminRoute = false }: SidebarProps) {
  return (
    <aside className={styles.aside}>
      <SidebarMenu isAdminRoute={isAdminRoute} />
      {!isAdminRoute && <QuickActions />}
      <NavGroup isAdminRoute={isAdminRoute} />
      <UserMenu />
    </aside>
  );
}
