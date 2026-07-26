"use client";

import { SortPicker } from "./components/SortPicker";
import { TopbarFilters } from "./components/TopbarFilters";
import { ViewSwitch } from "./components/ViewSwitch";
import styles from "./topbar.module.scss";
import { useTopbar } from "./useTopbar";

export function TopbarClient() {
  const {
    isPending,
    showFilters,
    showSort,
    project,
    filters,
    filterCount,
    sortKey,
    view,
    toggleFilter,
    clearFilter,
    clearAll,
    setSort,
    setView,
  } = useTopbar();

  if (!showFilters) return null;

  return (
    <header
      className={`${styles.header}${isPending ? ` ${styles.pending}` : ""}`}
    >
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

        <div className={styles.trailing}>
          {showSort && <SortPicker value={sortKey} onChange={setSort} />}
          <ViewSwitch value={view} onChange={setView} />
        </div>
      </div>
    </header>
  );
}
