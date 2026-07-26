"use client";

import { Icon } from "@iconify/react";
import { SegmentedControl } from "@/components/ui/atoms/SegmentedControl/SegmentedControl";
import type { View } from "../useTopbar";

interface ViewSwitchProps {
  value: View;
  onChange: (view: View) => void;
}

export function ViewSwitch({ value, onChange }: ViewSwitchProps) {
  return (
    <SegmentedControl
      variant="surface"
      value={value}
      onChange={(v) => onChange(v as View)}
      items={[
        {
          value: "board",
          icon: <Icon icon="lucide:layout-dashboard" width={16} />,
        },
        { value: "list", icon: <Icon icon="lucide:list" width={16} /> },
      ]}
    />
  );
}
