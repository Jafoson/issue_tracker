"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import type { Label, Priority, Project, Status, User } from "@/types";
import { IssueSearch } from "./components/IssueSearch";
import { SortPicker } from "./components/SortPicker";
import { TopbarFilters } from "./components/TopbarFilters";
import { ViewSwitch } from "./components/ViewSwitch";
import styles from "./topbar.module.scss";
import { useTopbar } from "./useTopbar";

interface TopbarClientProps {
  /** Issues in the current view — already narrowed by the active filters. */
  count: number;
  workspaceId: string;
  projects: Project[];
  statuses: Status[];
  priorities: Priority[];
  members: User[];
  labels: Label[];
}

export function TopbarClient({
  count,
  workspaceId,
  projects,
  statuses,
  priorities,
  members,
  labels,
}: TopbarClientProps) {
  const t = useTranslations();
  const {
    isPending,
    showFilters,
    showSort,
    project,
    filters,
    filterCount,
    searchValue,
    sortKey,
    view,
    toggleFilter,
    clearFilter,
    clearAll,
    search,
    setSort,
    setView,
  } = useTopbar({ workspaceId, projects, priorities, members, labels });

  if (!showFilters) return null;

  return (
    <header
      className={`${styles.header}${isPending ? ` ${styles.pending}` : ""}`}
    >
      <div className={styles.titleRow}>
        <h1 className={styles.title}>
          {view === "list" ? t("nav.issues") : t("nav.board")}
        </h1>
        <Badge className={styles.count}>{count}</Badge>

        <div className={styles.trailing}>
          <IssueSearch initialValue={searchValue} onChange={search} />
          <ViewSwitch value={view} onChange={setView} />
        </div>
      </div>

      <div className={styles.filterRow}>
        <TopbarFilters
          filters={filters}
          filterCount={filterCount}
          projectId={project?.id ?? ""}
          projectName={project?.name ?? ""}
          workspaceId={workspaceId}
          statuses={statuses}
          priorities={priorities}
          members={members}
          labels={labels}
          onToggle={toggleFilter}
          onClear={clearFilter}
          onClearAll={clearAll}
        />

        {showSort && (
          <div className={styles.trailing}>
            <SortPicker value={sortKey} onChange={setSort} />
          </div>
        )}
      </div>
    </header>
  );
}
