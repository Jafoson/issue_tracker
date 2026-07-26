"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/atoms/Button/Button";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import type { SortKey } from "../useTopbar";

const SORT_KEYS: SortKey[] = [
  "priority",
  "status",
  "updated",
  "created",
  "title",
  "assignee",
];

interface SortPickerProps {
  value: SortKey;
  onChange: (key: SortKey) => void;
}

export function SortPicker({ value, onChange }: SortPickerProps) {
  const t = useTranslations();
  const items = SORT_KEYS.map((key) => ({
    value: key,
    label: t(`sort.${key}`),
  }));

  return (
    <InlinePicker
      width={180}
      trigger={
        <Button
          variant="ghost"
          size="sm"
          icon={<Icon icon="lucide:arrow-down" width={14} />}
        >
          {items.find((o) => o.value === value)?.label ?? t("sort.label")}
        </Button>
      }
    >
      {(close) => (
        <SelectMenu
          items={items}
          value={value}
          onPick={(v) => {
            onChange(v as SortKey);
            close();
          }}
          onClose={close}
        />
      )}
    </InlinePicker>
  );
}
