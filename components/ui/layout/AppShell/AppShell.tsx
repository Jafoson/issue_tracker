import { Sidebar } from "@/components/ui/layout/Sidebar/Sidebar";
import { ModalOutlet } from "@/lib/context";
import { TabBar } from "../TabBar/TabBar";
import styles from "./appShell.module.scss";

interface AppShellProps {
  children: React.ReactNode;
  isAdminRoute?: boolean;
}

function Shell({ children, isAdminRoute }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <Sidebar isAdminRoute={isAdminRoute} />
      <div className={styles.main}>
        <TabBar isAdminRoute={isAdminRoute} />
        <div className={styles.content}>{children}</div>
      </div>
      {/* Rendert Modals hier im Baum — dadurch sehen sie den WorkspaceProvider,
          der die AppShell umschließt. */}
      <ModalOutlet />
    </div>
  );
}

export function AppShell({ children, isAdminRoute = false }: AppShellProps) {
  return <Shell isAdminRoute={isAdminRoute}>{children}</Shell>;
}
