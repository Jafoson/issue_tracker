"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import type { Project } from "@/types";
import { Button } from "../../atoms/Button/Button";
import { Tab } from "./Tab";
import styles from "./tabBar.module.scss";
import { tabMeta } from "./tabMeta";
import { useTabBar } from "./useTabBar";

interface TabBarClientProps {
  // Href des ersten Tabs bzw. neu geöffneter Tabs — abhängig vom aktuellen
  // Bereich (z.B. `/<workspaceId>/my` oder `/admin`).
  defaultHref: string;
  // Projekte des aktuellen Workspace — zum Auflösen von Name/Farbe der
  // Projekt-Tabs. Tabs anderer Workspaces fallen mangels Daten auf "Board".
  projects: Project[];
}

// Client-Logik der TabBar: hält den globalen Tab-Zustand (localStorage, aktiver
// Tab) über die gesamte Liste. Titel/Icon werden pro Tab aus dessen URL
// abgeleitet, daher genügt der defaultHref + die aktuellen Projekte.
export function TabBarClient({ defaultHref, projects }: TabBarClientProps) {
  const t = useTranslations();

  const { tabs, activeId, ready, switchTab, openTab, closeTab } =
    useTabBar(defaultHref);

  if (!ready) return <div className={styles.bar} />;

  return (
    <div className={styles.bar} role="tablist">
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          meta={tabMeta(tab.href, projects, t)}
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
