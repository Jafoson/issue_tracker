import { UserMenu } from "./components/UserMenu";
import WorkspaceMenu from "./components/WorkSpaceMenu";
import styles from "./sidebar.module.scss";

export function Sidebar() {
  return <aside className={styles.aside}>
    <WorkspaceMenu />
     <UserMenu />
  </aside>;
}
