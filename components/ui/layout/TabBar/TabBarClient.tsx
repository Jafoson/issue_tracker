"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import type { Project } from "@/types";
import { Button } from "../../atoms/Button/Button";
import { Tab } from "./Tab";
import styles from "./tabBar.module.scss";
import { useTabBar } from "./useTabBar";

interface TabBarClientProps {
  // Href of the first tab / newly opened tabs — depends on the current area
  // (e.g. `/<workspaceId>/my` or `/admin`).
  defaultHref: string;
  // Projects of the current workspace, preloaded server-side.
  projects: Project[];
  // ID of the currently active workspace, or `null` in the admin area.
  currentWorkspaceId: string | null;
}

// Pure rendering: the entire tab state (persistence, navigation,
// title/color/icon per tab) lives in useTabBar — analogous to how the
// sidebar lets its NavGroups render finished tab lists instead of holding
// logic itself.
export function TabBarClient({
  defaultHref,
  projects,
  currentWorkspaceId,
}: TabBarClientProps) {
  const t = useTranslations();
  const { tabs, activeId, ready, switchTab, openTab, closeTab } = useTabBar({
    defaultHref,
    projects,
    currentWorkspaceId,
  });

  if (!ready) return <div className={styles.bar} />;

  return (
    <div className={styles.bar}>
      {/* Own scroll container: with many tabs, the strip scrolls instead
          of squeezing every tab down to illegibility — the plus button
          stays visible throughout. */}
      <div className={styles.strip} role="tablist">
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            meta={tab.meta}
            isActive={tab.id === activeId}
            onSelect={() => switchTab(tab.id)}
            onClose={() => closeTab(tab.id)}
          />
        ))}
      </div>

      <Button
        variant="text"
        size="sm"
        className={styles.add}
        aria-label={t("actions.newTab")}
        icon={<Icon icon="lucide:plus" width={14} />}
        onClick={openTab}
      />
    </div>
  );
}
