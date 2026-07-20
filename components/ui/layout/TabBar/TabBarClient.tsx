"use client";

import { Icon } from "@iconify/react";
import type { Project } from "@/types";
import { Button } from "../../atoms/Button/Button";
import { Tab } from "./Tab";
import styles from "./tabBar.module.scss";
import { useTabBar } from "./useTabBar";

interface TabBarClientProps {
  // Href des ersten Tabs bzw. neu geöffneter Tabs — abhängig vom aktuellen
  // Bereich (z.B. `/<workspaceId>/my` oder `/admin`).
  defaultHref: string;
  // Projekte des aktuellen Workspace, serverseitig vorgeladen.
  projects: Project[];
  // ID des gerade aktiven Workspace, oder `null` im Admin-Bereich.
  currentWorkspaceId: string | null;
}

// Reine Darstellung: der gesamte Tab-Zustand (Persistenz, Navigation,
// Titel/Farbe/Icon pro Tab) lebt in useTabBar — analog dazu, wie die Sidebar
// ihre NavGroups fertige Tab-Listen rendern lässt, statt selbst Logik zu halten.
export function TabBarClient({
  defaultHref,
  projects,
  currentWorkspaceId,
}: TabBarClientProps) {
  const { tabs, activeId, ready, switchTab, openTab, closeTab } = useTabBar({
    defaultHref,
    projects,
    currentWorkspaceId,
  });

  if (!ready) return <div className={styles.bar} />;

  return (
    <div className={styles.bar} role="tablist">
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          meta={tab.meta}
          isActive={tab.id === activeId}
          onSelect={() => switchTab(tab.id)}
          onClose={() => closeTab(tab.id)}
        />
      ))}

      <Button
        variant="text"
        icon={<Icon icon="lucide:plus" width={14} />}
        onClick={openTab}
      />
    </div>
  );
}
