"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { IssueSearch } from "./components/IssueSearch";
import { SortPicker } from "./components/SortPicker";
import { TopbarFilters } from "./components/TopbarFilters";
import { ViewSwitch } from "./components/ViewSwitch";
import styles from "./topbar.module.scss";
import { useTopbar } from "./useTopbar";

interface TopbarClientProps {
  /** Issues in the current view — already narrowed by the active filters. */
  count: number;
}

export function TopbarClient({ count }: TopbarClientProps) {
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
  } = useTopbar();

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
