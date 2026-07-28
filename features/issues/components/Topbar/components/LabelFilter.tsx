"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LabelIcon } from "@/features/issues/components/IssueIcons/IssueIcons";
import { LabelPickerMenu } from "@/features/issues/components/LabelPickerMenu/LabelPickerMenu";
import { useWorkspace } from "@/lib/workspace-context";
import type { Label } from "@/types";
import { FilterChip } from "./FilterChip";
import { LabelDots } from "./FilterIcons";

interface LabelFilterProps {
  value: string[];
  projectId: string;
  projectName: string;
  onToggle: (id: string) => void;
  onClear: () => void;
}

export function LabelFilter({
  value,
  projectId,
  projectName,
  onToggle,
  onClear,
}: LabelFilterProps) {
  const { labels, workspace } = useWorkspace();
  const t = useTranslations();
  const router = useRouter();
  // Labels created from inside the picker show up immediately, before the
  // refreshed workspace data comes back.
  const [created, setCreated] = useState<Label[]>([]);

  const allLabels = [
    ...labels,
    ...created.filter((l) => !labels.some((a) => a.id === l.id)),
  ];
  const selected = value
    .map((id) => allLabels.find((l) => l.id === id))
    .filter((l): l is Label => Boolean(l));

  const name = t("fields.label");
  const label =
    value.length === 0
      ? name
      : value.length === 1
        ? (selected[0]?.name ?? name)
        : t("filters.labels", { count: value.length });

  return (
    <FilterChip
      name={name}
      label={label}
      active={value.length > 0}
      onClear={onClear}
      width={220}
      icon={
        selected.length === 0 ? (
          <Icon icon="lucide:tag" width={13} />
        ) : selected.length === 1 ? (
          <LabelIcon color={selected[0].color} size={13} />
        ) : (
          <LabelDots labels={selected} />
        )
      }
    >
      {(close) => (
        <LabelPickerMenu
          allLabels={allLabels}
          selected={value}
          projectId={projectId}
          projectName={projectName}
          workspaceId={workspace.id}
          onPick={onToggle}
          onCreated={(l) => {
            setCreated((cur) => [...cur, l]);
            router.refresh();
          }}
          onClose={close}
          keepOpen
        />
      )}
    </FilterChip>
  );
}
