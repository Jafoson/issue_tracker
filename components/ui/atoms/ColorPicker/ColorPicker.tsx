"use client";

import { PALETTE } from "@/lib/utils";
import styles from "./colorPicker.module.scss";

interface ColorPickerProps {
  /** Currently selected color. Omitted when the selection directly triggers an action. */
  value?: string;
  onChange: (color: string) => void;
  /** Alternate palette. Default: the shared palette from `lib/utils/color`. */
  colors?: readonly string[];
  /** `sm` for popovers/menus, `md` (default) for forms and modals. */
  size?: "sm" | "md";
  /** Accessible label per swatch — pass it in localized. */
  swatchLabel?: (color: string) => string;
}

/** Color grid for picking an accent color (workspace, project, label, ...). */
export function ColorPicker({
  value,
  onChange,
  colors = PALETTE,
  size = "md",
  swatchLabel,
}: ColorPickerProps) {
  return (
    <div className={`${styles.swatches} ${styles[size]}`}>
      {colors.map((color) => {
        const active = color === value;
        return (
          <button
            key={color}
            type="button"
            className={[styles.swatch, active && styles.active]
              .filter(Boolean)
              .join(" ")}
            style={{ background: color }}
            aria-label={swatchLabel?.(color) ?? color}
            aria-pressed={active}
            onClick={() => onChange(color)}
          />
        );
      })}
    </div>
  );
}
