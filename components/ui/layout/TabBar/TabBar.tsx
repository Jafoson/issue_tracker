"use client";

import { Icon } from "@iconify/react";
import { useParams } from "next/navigation";
import { toProjectSlug } from "@/lib/slug";
import { type T, useTranslations } from "@/lib/translations-context";
import { useWorkspace } from "@/lib/workspace-context";
import type { Project } from "@/types";
import styles from "./tabBar.module.scss";
import { useTabBar } from "./useTabBar";

function tabTitle(
  href: string,
  projects: Project[],
  t: T,
  base: string,
): string {
  const m = href.match(new RegExp(`^${base}/project/([^/]+)`));
  if (m)
    return (
      projects.find((p) => toProjectSlug(p.name) === m[1])?.name ?? t.nav.board
    );
  if (href.startsWith(`${base}/my`)) return t.nav.myIssues;
  if (href.startsWith(`${base}/inbox`)) return t.nav.inbox;
  if (href.startsWith(`${base}/members`)) return t.nav.members;
  if (href.startsWith(`${base}/teams`)) return t.nav.teams;
  if (href.startsWith(`${base}/settings`)) return t.nav.settings;
  if (href.startsWith(`${base}/projects`)) return t.nav.projects;
  return "Orbit";
}

function tabColor(
  href: string,
  projects: Project[],
  base: string,
): string | null {
  const m = href.match(new RegExp(`^${base}/project/([^/]+)`));
  if (!m) return null;
  return projects.find((p) => toProjectSlug(p.name) === m[1])?.color ?? null;
}

function tabIcon(href: string, base: string): string {
  if (href.includes("/project/") && href.endsWith("/list"))
    return "lucide:list";
  if (href.includes("/project/")) return "lucide:layout-dashboard";
  if (href.startsWith(`${base}/my`)) return "lucide:user";
  if (href.startsWith(`${base}/inbox`)) return "lucide:inbox";
  if (href.startsWith(`${base}/members`)) return "lucide:users";
  if (href.startsWith(`${base}/teams`)) return "lucide:users-2";
  if (href.startsWith(`${base}/settings`)) return "lucide:settings";
  if (href.startsWith(`${base}/projects`)) return "lucide:folders";
  return "lucide:layout-dashboard";
}

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
    <div className={styles.bar}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        // Strip the query string — tab.href carries filters (?status=…), but the
        // title/color/icon are derived from the path only.
        const path = tab.href.split("?")[0];
        const color = tabColor(path, projects, base);
        const icon = color ? null : tabIcon(path, base);

        // List ("Aufgaben") view of a project → "Projektname (Aufgaben)" to set
        // it apart from the board tab, which shows the bare project name.
        let title = tabTitle(path, projects, t, base);
        if (path.includes("/project/") && path.endsWith("/list")) {
          title = `${title} (${t.nav.issues})`;
        }

        return (
          <div
            key={tab.id}
            role="button"
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
