"use client";

import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { useUI } from "@/lib/ui-store";
import { useWorkspace } from "@/lib/workspace-context";
import { getT } from "@/lib/i18n";
import type { T } from "@/lib/i18n";
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

function viewTitle(pathname: string, t: T, projects: { id: string; name: string }[]): string {
  if (pathname.startsWith("/board/")) return projects.find((p) => p.id === pathname.split("/")[2])?.name ?? t.nav.board;
  if (pathname.startsWith("/list/"))  return t.nav.issues;
  if (pathname === "/my")             return t.nav.myIssues;
  if (pathname === "/inbox")          return t.nav.inbox;
  if (pathname === "/members")        return t.nav.members;
  if (pathname === "/teams")          return t.nav.teams;
  if (pathname === "/settings")       return t.nav.settings;
  return "Orbit";
}

export function TopbarClient() {
  const { ui } = useUI();
  const { projects } = useWorkspace();
  const t = getT(ui.locale);

  const {
    router, pathname, isPending, showFilters, showSort,
    f, filterCount, sortKey,
    pushParams, toggleFilter, clearFilter, clearAll,
  } = useTopbar();

  const SORT_OPTIONS = sortOptions(t);

  return (
    <header className={`${styles.header}${isPending ? " loading" : ""}`}>
      <div className={styles.topRow}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{viewTitle(pathname, t, projects)}</h1>
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
              value={pathname.startsWith("/board/") ? "board" : "list"}
              onChange={(v) => router.push(`/${v}/${pathname.split("/")[2] ?? projects[0]?.id}`)}
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
