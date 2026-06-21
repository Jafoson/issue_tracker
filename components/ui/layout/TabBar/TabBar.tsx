"use client";

import { Icon } from "@iconify/react";
import { useParams } from "next/navigation";
import { useTranslations } from "@/lib/translations-context";
import { useWorkspace } from "@/lib/workspace-context";
import styles from "./tabBar.module.scss";
import { tabMeta } from "./tabMeta";
import { useTabBar } from "./useTabBar";

export function TabBar() {
  const { locale, workspace } = useParams<{
    locale: string;
    workspace: string;
  }>();
  const base = `/${locale}/${workspace}`;
  const { projects } = useWorkspace();
  const t = useTranslations();

  const { tabs, activeId, ready, switchTab, openTab, closeTab } = useTabBar(
    workspace,
    `${base}/my`,
  );

  if (!ready) return <div className={styles.bar} />;

  return (
    <div className={styles.bar} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        const { title, color, icon } = tabMeta(tab.href, projects, t, base);

        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            className={`${styles.tab}${isActive ? ` ${styles.active}` : ""}`}
            onClick={() => switchTab(tab.id)}
            onKeyDown={(e) =>
              e.key === "Enter" || e.key === " " ? switchTab(tab.id) : undefined
            }
          >
            {color ? (
              <span className={styles.dot} style={{ background: color }} />
            ) : (
              <Icon
                icon={icon ?? "lucide:layout-dashboard"}
                width={14}
                className={styles.icon}
              />
            )}
            <span className={styles.label}>{title}</span>
            <button
              type="button"
              className={styles.close}
              aria-label="Close tab"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
            >
              <Icon icon="lucide:x" width={10} />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        className={styles.add}
        aria-label="Open new tab"
        onClick={openTab}
      >
        <Icon icon="lucide:plus" width={14} />
      </button>
    </div>
  );
}
