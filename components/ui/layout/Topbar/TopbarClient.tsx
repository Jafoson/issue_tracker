"use client";

import { Icon } from "@iconify/react";
import { useParams } from "next/navigation";
import { useTranslations } from "@/lib/translations-context";
import type { T } from "@/lib/translations-context";
import { Button } from "@/components/ui/atoms/Button/Button";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";

import { useWorkspace } from "@/lib/workspace-context";
import { toProjectSlug } from "@/lib/slug";


import { SegmentedControl } from "@/components/ui/atoms/SegmentedControl/SegmentedControl";
import { useTopbar, type SortKey } from "./useTopbar";
import { TopbarFilters } from "./components/TopbarFilters";
import styles from "./topbar.module.scss";

function sortOptions(t: T) {
  return [
    { value: "priority" as SortKey, label: t.sort.priority },
    { value: "status"   as SortKey, label: t.sort.status   },
    { value: "updated"  as SortKey, label: t.sort.updated  },
    { value: "created"  as SortKey, label: t.sort.created  },
    { value: "title"    as SortKey, label: t.sort.title    },
    { value: "assignee" as SortKey, label: t.sort.assignee },
  ];
}

function viewTitle(pathname: string, t: T, projects: { id: string; name: string }[], base: string): string {
  const projectMatch = pathname.match(new RegExp(`^${base}/project/([^/]+)`));
  if (projectMatch) {
    const slug = projectMatch[1];
    return projects.find((p) => toProjectSlug(p.name) === slug)?.name ?? t.nav.board;
  }
  if (pathname === `${base}/my`)        return t.nav.myIssues;
  if (pathname === `${base}/inbox`)     return t.nav.inbox;
  if (pathname === `${base}/members`)   return t.nav.members;
  if (pathname === `${base}/teams`)     return t.nav.teams;
  if (pathname === `${base}/settings`)  return t.nav.settings;
  return "Orbit";
}

export function TopbarClient() {

  const { projects } = useWorkspace();
  const t = useTranslations();
  const { locale, workspace } = useParams<{ locale: string; workspace: string }>();
  const base = `/${locale}/${workspace}`;

  const {
    router, pathname, isPending, showFilters, showSort,
    f, filterCount, sortKey,
    pushParams, toggleFilter, clearFilter, clearAll,
  } = useTopbar();

  const currentSlug = pathname.match(new RegExp(`^${base}/project/([^/]+)`))?.[1] ?? toProjectSlug(projects[0]?.name ?? "");

  const SORT_OPTIONS = sortOptions(t);

  return (
    <header className={`${styles.header}${isPending ? " loading" : ""}`}>
      <div className={styles.topRow}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{viewTitle(pathname, t, projects, base)}</h1>
        </div>


        <div className={styles.actions}>
          {showSort && (
            <InlinePicker
              trigger={
                <Button variant="ghost" size="sm" icon={<Icon icon="lucide:arrow-down" width={14} />}>
                  {SORT_OPTIONS.find((o) => o.value === sortKey)?.label ?? t.sort.label}
                </Button>
              }
              width={180}
            >
              {(close) => (
                <SelectMenu
                  items={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  value={sortKey}
                  onPick={(v) => { pushParams((p) => p.set("sort", v as string)); close(); }}
                  onClose={close}
                />
              )}
            </InlinePicker>
          )}

          {showFilters && (
            <SegmentedControl
              variant="surface"
              value={pathname.endsWith("/list") ? "list" : "board"}
              onChange={(v) => router.push(v === "list" ? `${base}/project/${currentSlug}/list` : `${base}/project/${currentSlug}`)}
              items={[
                { value: "board", icon: <Icon icon="lucide:layout-dashboard" width={16} /> },
                { value: "list",  icon: <Icon icon="lucide:list"             width={16} /> },
              ]}
            />
          )}
        </div>
      </div>

      {showFilters && (
        <TopbarFilters
          f={f}
          filterCount={filterCount}
          onToggle={toggleFilter}
          onClear={clearFilter}
          onClearAll={clearAll}
          t={t}
        />
      )}
    </header>
  );
}
