"use client";

import { Icon } from "@iconify/react";
import { useState, useTransition } from "react";
import { ColorPicker } from "@/components/ui/atoms/ColorPicker/ColorPicker";
import {
  SelectAction,
  SelectEmpty,
} from "@/components/ui/atoms/SelectMenu/atoms/SelectAction";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { createLabel } from "@/features/issues/actions";
import { LabelIcon } from "@/features/issues/components/IssueIcons/IssueIcons";
import type { Label } from "@/types";
import styles from "./labelPickerMenu.module.scss";

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

  // Ein Label gehört entweder diesem Projekt oder dem ganzen Workspace — und im
  // zweiten Fall kann das Projekt es für sich ausgeblendet haben (`hiddenIn`).
  // An Aufgaben, die es schon tragen, bleibt es trotzdem stehen; hier geht es
  // nur darum, was noch vergeben werden kann.
  const visible = allLabels.filter(
    (l) =>
      (!l.projectId || l.projectId === projectId) &&
      !l.hiddenIn?.includes(projectId),
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
        <div className={styles.colorGrid}>
          <ColorPicker size="sm" onChange={handleColorPick} />
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
