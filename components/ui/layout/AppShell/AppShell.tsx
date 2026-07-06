import { Sidebar } from "@/components/ui/layout/Sidebar/Sidebar";
import { TabBar } from "../TabBar/TabBar";
import styles from "./appShell.module.scss";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.main}>
        <TabBar />
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
      <Shell>{children}</Shell>
  );
}
