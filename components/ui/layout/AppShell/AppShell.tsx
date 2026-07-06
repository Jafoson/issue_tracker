"use client";

import { Suspense} from "react";
import { Sidebar } from "@/components/ui/layout/Sidebar/Sidebar";
import type { WorkspaceData } from "@/lib/workspace-context";
import styles from "./appShell.module.scss";
import { TabBar } from "../TabBar/TabBar";


function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <Sidebar/>
      <div className={styles.main}>
        <TabBar/>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
        <Suspense fallback={null}>
          <Shell>{children}</Shell>
        </Suspense>
  );
}
