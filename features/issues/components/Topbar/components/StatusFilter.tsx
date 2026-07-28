"use client";

import { useTranslations } from "next-intl";
import { FilterChip } from "@/components/ui/atoms/FilterChip/FilterChip";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { StatusIcon } from "@/features/issues/components/IssueIcons/IssueIcons";
import type { Status } from "@/types";
import { MultiStatusIcon } from "./FilterIcons";

interface StatusFilterProps {
  value: string[];
  statuses: Status[];
  onToggle: (id: string) => void;
  onClear: () => void;
}

export function StatusFilter({
  value,
  statuses,
  onToggle,
  onClear,
}: StatusFilterProps) {
  const t = useTranslations();

  const name = t("fields.status");
  const selected = value[0]
    ? (statuses.find((s) => s.id === value[0]) ?? null)
    : null;
  const label =
    value.length === 0
      ? name
      : value.length === 1
        ? (selected?.name ?? value[0])
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
          <StatusIcon
            status={value[0] ?? "todo"}
            size={14}
            color={selected?.color}
          />
        ) : (
          <MultiStatusIcon />
        )
      }
    >
      <SelectMenu
        items={statuses.map((s) => ({
          value: s.id,
          label: s.name,
          icon: <StatusIcon status={s.id} size={15} color={s.color} />,
        }))}
        value={value}
        onPick={(v) => onToggle(v as string)}
        multi
        searchable
      />
    </FilterChip>
  );
}
