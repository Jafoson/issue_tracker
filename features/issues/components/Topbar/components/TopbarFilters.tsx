"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/atoms/Button/Button";
import type { Label, Priority, Project, Status, User } from "@/types";
import styles from "../topbar.module.scss";
import type { FilterKey, FilterState, IssueArea } from "../useTopbar";
import { AssigneeFilter } from "./AssigneeFilter";
import { LabelFilter } from "./LabelFilter";
import { PriorityFilter } from "./PriorityFilter";
import { ProjectFilter } from "./ProjectFilter";
import { StatusFilter } from "./StatusFilter";

interface TopbarFiltersProps {
  filters: FilterState;
  filterCount: number;
  /** Woraufhin die Ansicht zeigt — entscheidet über die letzte Chip-Stelle. */
  area: IssueArea;
  /** Leer im Bereich „Meine Aufgaben“: dort gibt es kein einzelnes Projekt. */
  projectId: string;
  projectName: string;
  workspaceId: string;
  statuses: Status[];
  priorities: Priority[];
  members: User[];
  labels: Label[];
  projects: Project[];
  onToggle: (key: FilterKey, value: string | number) => void;
  onClear: (key: FilterKey) => void;
  onClearAll: () => void;
}

export function TopbarFilters({
  filters,
  filterCount,
  area,
  projectId,
  projectName,
  workspaceId,
  statuses,
  priorities,
  members,
  labels,
  projects,
  onToggle,
  onClear,
  onClearAll,
}: TopbarFiltersProps) {
  const t = useTranslations();

  return (
    <>
      <StatusFilter
        value={filters.status}
        statuses={statuses}
        onToggle={(id) => onToggle("status", id)}
        onClear={() => onClear("status")}
      />
      <PriorityFilter
        value={filters.priority}
        priorities={priorities}
        onToggle={(id) => onToggle("priority", id)}
        onClear={() => onClear("priority")}
      />
      {/* Die letzte Stelle beantwortet, was der Bereich offen lässt: im Projekt
          ist das die Zuständigkeit, bei den eigenen Aufgaben das Projekt — die
          jeweils andere Frage ist dort schon entschieden. */}
      {area === "project" ? (
        <AssigneeFilter
          value={filters.assignee}
          members={members}
          onToggle={(id) => onToggle("assignee", id)}
          onClear={() => onClear("assignee")}
        />
      ) : (
        <ProjectFilter
          value={filters.project}
          projects={projects}
          onToggle={(id) => onToggle("project", id)}
          onClear={() => onClear("project")}
        />
      )}
      <LabelFilter
        value={filters.label}
        labels={labels}
        projectId={projectId}
        projectName={projectName}
        workspaceId={workspaceId}
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
