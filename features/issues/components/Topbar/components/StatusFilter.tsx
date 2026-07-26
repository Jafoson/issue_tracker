"use client";

import { useTranslations } from "next-intl";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { StatusIcon } from "@/features/issues/components/IssueIcons/IssueIcons";
import { useWorkspace } from "@/lib/workspace-context";
import { FilterChip } from "./FilterChip";
import { MultiStatusIcon } from "./FilterIcons";

interface StatusFilterProps {
  value: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}

export function StatusFilter({ value, onToggle, onClear }: StatusFilterProps) {
  const { statuses } = useWorkspace();
  const t = useTranslations();

  const name = t("fields.status");
  const label =
    value.length === 0
      ? name
      : value.length === 1
        ? (statuses.find((s) => s.id === value[0])?.name ?? value[0])
        : t("filters.statuses", { count: value.length });

  return (
    <FilterChip
      
      name={name}
      label={label}
      active={value.length > 0}
      onClear={onClear}
      width={200}
      icon={
        value.length <= 1 ? (
          <StatusIcon status={value[0] ?? "todo"} size={14} />
        ) : (
          <MultiStatusIcon />
        )
      }
    >
      <SelectMenu
        items={statuses.map((s) => ({
          value: s.id,
          label: s.name,
          icon: <StatusIcon status={s.id} size={15} />,
        }))}
        value={value}
        onPick={(v) => onToggle(v as string)}
        multi
        searchable
      />
    </FilterChip>
  );
}
