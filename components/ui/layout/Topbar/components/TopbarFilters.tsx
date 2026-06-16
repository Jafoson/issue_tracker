"use client";

import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { StatusIcon, PriorityIcon } from "@/features/issues/components/IssueIcons/IssueIcons";
import { FilterChip } from "./FilterChip";
import { useWorkspace } from "@/lib/workspace-context";
import type { T } from "@/lib/i18n";
import styles from "../topbar.module.scss";

interface FilterState {
  statuses:   string[];
  priorities: number[];
  assignees:  string[];
  labels:     string[];
}

interface TopbarFiltersProps {
  f:            FilterState;
  filterCount:  number;
  onToggle:     (key: string, value: string | number) => void;
  onClear:      (key: string) => void;
  onClearAll:   () => void;
  t:            T;
}

export function TopbarFilters({ f, filterCount, onToggle, onClear, onClearAll, t }: TopbarFiltersProps) {
  const { members, statuses, priorities, labels } = useWorkspace();

  const statusName   = (id: string) => statuses.find((s)  => s.id === id)?.name  ?? id;
  const priorityName = (id: number) => priorities.find((p) => p.id === id)?.name ?? String(id);

  return (
    <div className={styles.filterRow}>
      <InlinePicker
        trigger={
          <Button variant="text" style={{ padding: 0 }}>
            <FilterChip label={f.statuses.map(statusName).join(", ")} active={f.statuses.length > 0} onClear={() => onClear("status")}>
              <StatusIcon status={f.statuses[0] ?? "todo"} size={14} />
              {f.statuses.length === 0 ? t.fields.status : f.statuses.length === 1 ? statusName(f.statuses[0]) : t.filters.statuses(f.statuses.length)}
            </FilterChip>
          </Button>
        }
        width={200} stop
      >
        <SelectMenu items={statuses.map((s) => ({ value: s.id, label: s.name, icon: <StatusIcon status={s.id} size={15} /> }))}
          value={f.statuses} onPick={(v) => onToggle("status", v as string)} multi searchable />
      </InlinePicker>

      <InlinePicker
        trigger={
          <Button variant="text" style={{ padding: 0 }}>
            <FilterChip label={f.priorities.map(priorityName).join(", ")} active={f.priorities.length > 0} onClear={() => onClear("priority")}>
              <PriorityIcon priority={f.priorities[0] ?? 0} size={14} />
              {f.priorities.length === 0 ? t.fields.priority : f.priorities.length === 1 ? priorityName(f.priorities[0]) : t.filters.priorities(f.priorities.length)}
            </FilterChip>
          </Button>
        }
        width={190} stop
      >
        <SelectMenu items={priorities.map((p) => ({ value: p.id, label: p.name, icon: <PriorityIcon priority={p.id} size={15} /> }))}
          value={f.priorities} onPick={(v) => onToggle("priority", v as number)} multi searchable />
      </InlinePicker>

      <InlinePicker
        trigger={
          <Button variant="text" style={{ padding: 0 }}>
            <FilterChip
              label={f.assignees.map((id) => members.find((u) => u.id === id)?.name.split(" ")[0] ?? id).join(", ")}
              active={f.assignees.length > 0}
              onClear={() => onClear("assignee")}
            >
              {f.assignees.length > 0
                ? <Avatar user={members.find((u) => u.id === f.assignees[0]) ?? null} size={15} />
                : <Icon icon="lucide:user" width={14} />}
              {f.assignees.length === 0 ? t.fields.assignee
                : f.assignees.length === 1 ? (members.find((u) => u.id === f.assignees[0])?.name.split(" ")[0] ?? t.fields.assignee)
                : t.filters.people(f.assignees.length)}
            </FilterChip>
          </Button>
        }
        width={210} stop
      >
        <SelectMenu items={members.map((u) => ({ value: u.id, label: u.name, icon: <Avatar user={u} size={18} /> }))}
          value={f.assignees} onPick={(v) => onToggle("assignee", v as string)} multi searchable />
      </InlinePicker>

      <InlinePicker
        trigger={
          <Button variant="text" style={{ padding: 0 }}>
            <FilterChip
              label={f.labels.map((id) => labels.find((l) => l.id === id)?.name ?? id).join(", ")}
              active={f.labels.length > 0}
              onClear={() => onClear("label")}
            >
              <Icon icon="lucide:tag" width={14} />
              {f.labels.length === 0 ? t.fields.label
                : f.labels.length === 1 ? (labels.find((l) => l.id === f.labels[0])?.name ?? t.fields.label)
                : t.filters.labels(f.labels.length)}
            </FilterChip>
          </Button>
        }
        width={200} stop
      >
        <SelectMenu items={labels.map((l) => ({ value: l.id, label: l.name, icon: <span className="dot" style={{ background: l.color, width: 9, height: 9 }} /> }))}
          value={f.labels} onPick={(v) => onToggle("label", v as string)} multi searchable />
      </InlinePicker>

      {filterCount > 0 && (
        <Button variant="ghost" size="sm" icon={<Icon icon="lucide:x" width={13} />} style={{ color: "var(--accent)" }} onClick={onClearAll}>
          {t.actions.clear}
        </Button>
      )}
    </div>
  );
}
