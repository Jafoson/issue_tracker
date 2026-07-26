"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/atoms/Button/Button";
import styles from "../topbar.module.scss";
import type { FilterKey, FilterState } from "../useTopbar";
import { AssigneeFilter } from "./AssigneeFilter";
import { LabelFilter } from "./LabelFilter";
import { PriorityFilter } from "./PriorityFilter";
import { StatusFilter } from "./StatusFilter";

interface TopbarFiltersProps {
  filters: FilterState;
  filterCount: number;
  projectId: string;
  projectName: string;
  onToggle: (key: FilterKey, value: string | number) => void;
  onClear: (key: FilterKey) => void;
  onClearAll: () => void;
}

export function TopbarFilters({
  filters,
  filterCount,
  projectId,
  projectName,
  onToggle,
  onClear,
  onClearAll,
}: TopbarFiltersProps) {
  const t = useTranslations();

  return (
    <>
      <StatusFilter
        value={filters.status}
        onToggle={(id) => onToggle("status", id)}
        onClear={() => onClear("status")}
      />
      <PriorityFilter
        value={filters.priority}
        onToggle={(id) => onToggle("priority", id)}
        onClear={() => onClear("priority")}
      />
      <AssigneeFilter
        value={filters.assignee}
        onToggle={(id) => onToggle("assignee", id)}
        onClear={() => onClear("assignee")}
      />
      <LabelFilter
        value={filters.label}
        projectId={projectId}
        projectName={projectName}
        onToggle={(id) => onToggle("label", id)}
        onClear={() => onClear("label")}
      />

      {filterCount > 0 && (
        <Button
          variant="ghost"
          className={styles.clearAll}
          icon={<Icon icon="lucide:x" width={13} />}
          onClick={onClearAll}
        >
          {t("actions.clear")}
        </Button>
      )}
    </>
  );
}
