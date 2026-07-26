"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Chip } from "@/components/ui/atoms/Chip/Chip";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";

interface FilterChipProps {
  /** Field name, used for the clear button's accessible label. */
  name: string;
  /** What the chip reads as right now — the field name, or the selection. */
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClear: () => void;
  width?: number;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
}

/**
 * One filter facet in the topbar: a chip that opens a picker, and turns into a
 * clearable chip once something is selected.
 */
export function FilterChip({
  name,
  label,
  icon,
  active,
  onClear,
  width,
  children,
}: FilterChipProps) {
  const t = useTranslations();

  return (
    <InlinePicker
      width={width}
      stop
      trigger={
        <Chip
          type="filter"
          variant="text"
          icon={icon}
          selected={active}
          trailing={<Icon icon="lucide:chevron-down" width={13} />}
          onRemove={active ? onClear : undefined}
          removeLabel={t("actions.clearFilter", { field: name })}
        >
          {label}
        </Chip>
      }
    >
      {children}
    </InlinePicker>
  );
}
