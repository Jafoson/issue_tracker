"use client";

import { useTranslations } from "next-intl";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { PriorityIcon } from "@/features/issues/components/IssueIcons/IssueIcons";
import { useWorkspace } from "@/lib/workspace-context";
import { FilterChip } from "./FilterChip";
import { MultiPriorityIcon } from "./FilterIcons";

interface PriorityFilterProps {
  value: number[];
  onToggle: (id: number) => void;
  onClear: () => void;
}

export function PriorityFilter({
  value,
  onToggle,
  onClear,
}: PriorityFilterProps) {
  const { priorities } = useWorkspace();
  const t = useTranslations();

  const name = t("fields.priority");
  const label =
    value.length === 0
      ? name
      : value.length === 1
        ? (priorities.find((p) => p.id === value[0])?.name ?? String(value[0]))
        : t("filters.priorities", { count: value.length });

  return (
    <FilterChip
      name={name}
      label={label}
      active={value.length > 0}
      onClear={onClear}
      width={190}
      icon={
        value.length <= 1 ? (
          <PriorityIcon priority={value[0] ?? 0} size={14} />
        ) : (
          <MultiPriorityIcon />
        )
      }
    >
      <SelectMenu
        items={priorities.map((p) => ({
          value: p.id,
          label: p.name,
          icon: <PriorityIcon priority={p.id} size={15} />,
        }))}
        value={value}
        onPick={(v) => onToggle(v as number)}
        multi
        searchable
      />
    </FilterChip>
  );
}
