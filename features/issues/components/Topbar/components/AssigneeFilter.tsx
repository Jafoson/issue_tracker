"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { fullName } from "@/lib/utils/string";
import { useWorkspace } from "@/lib/workspace-context";
import { FilterChip } from "./FilterChip";

interface AssigneeFilterProps {
  value: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}

export function AssigneeFilter({
  value,
  onToggle,
  onClear,
}: AssigneeFilterProps) {
  const { members } = useWorkspace();
  const t = useTranslations();

  const name = t("fields.assignee");
  const selected =
    value.length > 0 ? (members.find((u) => u.id === value[0]) ?? null) : null;

  const label =
    value.length === 0
      ? name
      : value.length === 1
        ? (selected?.firstName ?? name)
        : t("filters.people", { count: value.length });

  return (
    <FilterChip
      name={name}
      label={label}
      active={value.length > 0}
      onClear={onClear}
      width={210}
      icon={
        selected ? (
          <Avatar avatar={selected} size={15} />
        ) : (
          <Icon icon="lucide:user" width={14} />
        )
      }
    >
      <SelectMenu
        items={members.map((u) => ({
          value: u.id,
          label: fullName(u),
          icon: <Avatar avatar={u} size={18} />,
        }))}
        value={value}
        onPick={(v) => onToggle(v as string)}
        multi
        searchable
      />
    </FilterChip>
  );
}
