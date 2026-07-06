import { UserMenu } from "./components/UserMenu/UserMenu";
import styles from "./sidebar.module.scss";

export function Sidebar() {
  return <aside className={styles.aside}>
     <UserMenu />
  </aside>;
}
