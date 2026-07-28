"use client";

import { Icon } from "@iconify/react";
import { useState, useTransition } from "react";
import {
  SelectAction,
  SelectEmpty,
} from "@/components/ui/atoms/SelectMenu/atoms/SelectAction";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { createLabel } from "@/features/issues/actions";
import { LabelIcon } from "@/features/issues/components/IssueIcons/IssueIcons";
import type { Label } from "@/types";
import styles from "./labelPickerMenu.module.scss";

export const LABEL_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#84cc16",
  "#14b8a6",
  "#0ea5e9",
  "#a855f7",
  "#d946ef",
  "#64748b",
  "#f59e0b",
  "#10b981",
  "#e11d48",
  "#7c3aed",
];

interface Props {
  allLabels: Label[];
  selected: string[];
  projectId: string;
  projectName: string;
  workspaceId: string;
  onPick: (id: string) => void;
  onCreated: (label: Label) => void;
  onClose: () => void;
  keepOpen?: boolean;
}

export function LabelPickerMenu({
  allLabels,
  selected,
  projectId,
  projectName,
  workspaceId,
  onPick,
  onCreated,
  onClose,
  keepOpen,
}: Props) {
  const [pending, setPending] = useState<{
    name: string;
    scope: "project" | "workspace";
  } | null>(null);
  const [, startCreate] = useTransition();

  const visible = allLabels.filter(
    (l) => !l.projectId || l.projectId === projectId,
  );

  const handleColorPick = (color: string) => {
    if (!pending) return;
    startCreate(async () => {
      const label = await createLabel({
        name: pending.name,
        color,
        workspaceId,
        projectId: pending.scope === "project" ? projectId : null,
      });
      onCreated({ ...label, projectId: label.projectId ?? null });
      onPick(label.id);
      setPending(null);
    });
  };

  if (pending) {
    return (
      <>
        <div className={styles.colorHeader}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => setPending(null)}
          >
            <Icon icon="lucide:arrow-left" width={14} />
          </button>
          <span>
            Farbe für <strong>„{pending.name}"</strong> wählen
          </span>
        </div>
        <div className={styles.swatches}>
          {LABEL_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={styles.swatch}
              style={{ background: color }}
              onClick={() => handleColorPick(color)}
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <SelectMenu
      multi
      searchable
      placeholder="Label suchen…"
      value={selected}
      onPick={(v) => {
        onPick(v as string);
        if (!keepOpen) onClose();
      }}
      onClose={onClose}
      items={visible.map((l) => ({
        value: l.id,
        label: l.name,
        icon: <LabelIcon color={l.color} />,
      }))}
      emptyState={(q) =>
        q.trim() ? (
          <>
            <SelectAction
              icon={<Icon icon="lucide:plus" width={14} />}
              onClick={() => setPending({ name: q.trim(), scope: "project" })}
            >
              „{q.trim()}" in <strong>{projectName}</strong> anlegen
            </SelectAction>
            <SelectAction
              icon={<Icon icon="lucide:plus" width={14} />}
              onClick={() => setPending({ name: q.trim(), scope: "workspace" })}
            >
              „{q.trim()}" im Workspace anlegen
            </SelectAction>
          </>
        ) : (
          <SelectEmpty>Keine Labels vorhanden</SelectEmpty>
        )
      }
    />
  );
}
