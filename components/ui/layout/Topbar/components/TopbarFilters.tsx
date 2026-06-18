"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Button } from "@/components/ui/atoms/Button/Button";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import {
  PriorityIcon,
  StatusIcon,
} from "@/features/issues/components/IssueIcons/IssueIcons";
import { LabelPickerMenu } from "@/features/issues/components/LabelPickerMenu/LabelPickerMenu";
import type { T } from "@/lib/translations-context";
import { useWorkspace } from "@/lib/workspace-context";
import type { Label } from "@/types";
import styles from "../topbar.module.scss";

interface FilterState {
  statuses: string[];
  priorities: number[];
  assignees: string[];
  labels: string[];
}

interface TopbarFiltersProps {
  f: FilterState;
  filterCount: number;
  onToggle: (key: string, value: string | number) => void;
  onClear: (key: string) => void;
  onClearAll: () => void;
  t: T;
  end?: React.ReactNode;
  projectId: string;
  projectName: string;
}

function ClearBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="iconbtn"
      style={{ marginLeft: -4 }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Icon icon="lucide:x" width={11} />
    </button>
  );
}

export function TopbarFilters({
  f,
  filterCount,
  onToggle,
  onClear,
  onClearAll,
  t,
  end,
  projectId,
  projectName,
}: TopbarFiltersProps) {
  const {
    members,
    statuses,
    priorities,
    labels,
    workspace: workspaceData,
  } = useWorkspace();
  const [localLabels, setLocalLabels] = useState<Label[]>([]);
  const router = useRouter();

  const allLabels = [
    ...labels,
    ...localLabels.filter((l) => !labels.some((a) => a.id === l.id)),
  ];

  const statusName = (id: string) =>
    statuses.find((s) => s.id === id)?.name ?? id;
  const priorityName = (id: number) =>
    priorities.find((p) => p.id === id)?.name ?? String(id);

  const assigneeUser =
    f.assignees.length > 0
      ? (members.find((u) => u.id === f.assignees[0]) ?? null)
      : null;

  const selectedLabel1 =
    f.labels.length === 1
      ? (allLabels.find((l) => l.id === f.labels[0]) ?? null)
      : null;

  const selectedLabelObjects = f.labels
    .map((id) => allLabels.find((l) => l.id === id))
    .filter(Boolean) as Label[];

  const labelIcon =
    f.labels.length === 0 ? (
      <Icon icon="lucide:tag" width={13} />
    ) : f.labels.length === 1 ? (
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: selectedLabel1?.color ?? "var(--text-3)",
          display: "inline-block",
          flexShrink: 0,
        }}
      />
    ) : (
      <span style={{ display: "flex", alignItems: "center" }}>
        {selectedLabelObjects.slice(0, 3).map((l, i) => (
          <span
            key={l.id}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: l.color,
              display: "inline-block",
              flexShrink: 0,
              marginLeft: i > 0 ? -4 : 0,
              boxShadow: "0 0 0 2px var(--panel-2)",
            }}
          />
        ))}
      </span>
    );

  return (
    <div className={styles.filterRow}>
      {/* Status */}
      <div style={{ display: "inline-flex", alignItems: "center" }}>
        <InlinePicker
          trigger={
            <Button
              variant="ghost"
              size="sm"
              icon={
                f.statuses.length <= 1 ? (
                  <StatusIcon status={f.statuses[0] ?? "todo"} size={14} />
                ) : (
                  <svg
                    width={14}
                    height={14}
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                    style={{ flex: "none", display: "block" }}
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="6.2"
                      fill="none"
                      stroke="var(--text-3)"
                      strokeWidth="1.6"
                      opacity=".6"
                    />
                  </svg>
                )
              }
              iconRight={
                <Icon icon="lucide:chevron-down" width={11} className="faint" />
              }
            >
              {f.statuses.length === 0
                ? t.fields.status
                : f.statuses.length === 1
                  ? statusName(f.statuses[0])
                  : t.filters.statuses(f.statuses.length)}
            </Button>
          }
          width={200}
          stop
        >
          <SelectMenu
            items={statuses.map((s) => ({
              value: s.id,
              label: s.name,
              icon: <StatusIcon status={s.id} size={15} />,
            }))}
            value={f.statuses}
            onPick={(v) => onToggle("status", v as string)}
            multi
            searchable
          />
        </InlinePicker>
        {f.statuses.length > 0 && (
          <ClearBtn onClick={() => onClear("status")} />
        )}
      </div>

      {/* Priority */}
      <div style={{ display: "inline-flex", alignItems: "center" }}>
        <InlinePicker
          trigger={
            <Button
              variant="ghost"
              size="sm"
              icon={
                f.priorities.length <= 1 ? (
                  <PriorityIcon priority={f.priorities[0] ?? 0} size={14} />
                ) : (
                  <svg
                    width={14}
                    height={14}
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                    style={{ flex: "none", display: "block" }}
                  >
                    {[
                      { x: 2.5, h: 5, y: 9 },
                      { x: 6.5, h: 8, y: 6 },
                      { x: 10.5, h: 11, y: 3 },
                    ].map((b) => (
                      <rect
                        key={b.x}
                        x={b.x}
                        y={b.y}
                        width="3"
                        height={b.h}
                        rx="1"
                        fill="var(--text-3)"
                        opacity=".35"
                      />
                    ))}
                  </svg>
                )
              }
              iconRight={
                <Icon icon="lucide:chevron-down" width={11} className="faint" />
              }
            >
              {f.priorities.length === 0
                ? t.fields.priority
                : f.priorities.length === 1
                  ? priorityName(f.priorities[0])
                  : t.filters.priorities(f.priorities.length)}
            </Button>
          }
          width={190}
          stop
        >
          <SelectMenu
            items={priorities.map((p) => ({
              value: p.id,
              label: p.name,
              icon: <PriorityIcon priority={p.id} size={15} />,
            }))}
            value={f.priorities}
            onPick={(v) => onToggle("priority", v as number)}
            multi
            searchable
          />
        </InlinePicker>
        {f.priorities.length > 0 && (
          <ClearBtn onClick={() => onClear("priority")} />
        )}
      </div>

      {/* Assignee */}
      <div style={{ display: "inline-flex", alignItems: "center" }}>
        <InlinePicker
          trigger={
            <Button
              variant="ghost"
              size="sm"
              icon={
                f.assignees.length > 0 ? (
                  <Avatar user={assigneeUser} size={15} />
                ) : (
                  <Icon icon="lucide:user" width={14} />
                )
              }
              iconRight={
                <Icon icon="lucide:chevron-down" width={11} className="faint" />
              }
            >
              {f.assignees.length === 0
                ? t.fields.assignee
                : f.assignees.length === 1
                  ? (assigneeUser?.name.split(" ")[0] ?? t.fields.assignee)
                  : t.filters.people(f.assignees.length)}
            </Button>
          }
          width={210}
          stop
        >
          <SelectMenu
            items={members.map((u) => ({
              value: u.id,
              label: u.name,
              icon: <Avatar user={u} size={18} />,
            }))}
            value={f.assignees}
            onPick={(v) => onToggle("assignee", v as string)}
            multi
            searchable
          />
        </InlinePicker>
        {f.assignees.length > 0 && (
          <ClearBtn onClick={() => onClear("assignee")} />
        )}
      </div>

      {/* Label */}
      <div style={{ display: "inline-flex", alignItems: "center" }}>
        <InlinePicker
          trigger={
            <Button
              variant="ghost"
              size="sm"
              icon={labelIcon}
              iconRight={
                <Icon icon="lucide:chevron-down" width={11} className="faint" />
              }
            >
              {f.labels.length === 0
                ? t.fields.label
                : f.labels.length === 1
                  ? (selectedLabel1?.name ?? t.fields.label)
                  : t.filters.labels(f.labels.length)}
            </Button>
          }
          width={220}
          stop
        >
          {(close) => (
            <LabelPickerMenu
              allLabels={allLabels}
              selected={f.labels}
              projectId={projectId}
              projectName={projectName}
              workspaceId={workspaceData.id}
              onPick={(id) => onToggle("label", id)}
              onCreated={(label) => {
                setLocalLabels((cur) => [...cur, label]);
                router.refresh();
              }}
              onClose={close}
              keepOpen
            />
          )}
        </InlinePicker>
        {f.labels.length > 0 && <ClearBtn onClick={() => onClear("label")} />}
      </div>

      {filterCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          icon={<Icon icon="lucide:x" width={13} />}
          style={{ color: "var(--accent)" }}
          onClick={onClearAll}
        >
          {t.actions.clear}
        </Button>
      )}

      {end && (
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {end}
        </div>
      )}
    </div>
  );
}
