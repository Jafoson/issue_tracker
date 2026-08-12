"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { FilterChip } from "@/components/ui/layout/FilterChip/FilterChip";
import {
  LabelDots,
  LabelIcon,
} from "@/features/issues/components/IssueIcons/IssueIcons";
import type { Project } from "@/types";

interface ProjectFilterProps {
  value: string[];
  projects: Project[];
  onToggle: (id: string) => void;
  onClear: () => void;
}

/**
 * Grenzt eine projektübergreifende Ansicht auf einzelne Projekte ein — im Board
 * und in der Liste eines Projekts gibt es ihn nicht, dort ist die Frage schon
 * durch die Adresse beantwortet.
 *
 * Zeichen ist der Projektpunkt, dieselbe Farbe wie in der Seitenleiste und der
 * Reiterleiste; bei mehreren stehen bis zu drei davon nebeneinander.
 */
export function ProjectFilter({
  value,
  projects,
  onToggle,
  onClear,
}: ProjectFilterProps) {
  const t = useTranslations();

  const selected = value
    .map((id) => projects.find((p) => p.id === id))
    .filter((p): p is Project => Boolean(p));

  const name = t("fields.project");
  const label =
    value.length === 0
      ? name
      : value.length === 1
        ? (selected[0]?.name ?? name)
        : t("filters.projects", { count: value.length });

  return (
    <FilterChip
      name={name}
      label={label}
      active={value.length > 0}
      onClear={onClear}
      width={220}
      icon={
        selected.length === 0 ? (
          <Icon icon="lucide:folders" width={13} />
        ) : selected.length === 1 ? (
          <LabelIcon color={selected[0].color} size={13} />
        ) : (
          <LabelDots labels={selected} />
        )
      }
    >
      <SelectMenu
        items={projects.map((p) => ({
          value: p.id,
          label: p.name,
          icon: <LabelIcon color={p.color} size={13} />,
        }))}
        value={value}
        onPick={(v) => onToggle(v as string)}
        multi
        searchable
      />
    </FilterChip>
  );
}
