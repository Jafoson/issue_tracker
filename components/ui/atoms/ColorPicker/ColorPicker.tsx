"use client";

import styles from "./colorPicker.module.scss";
import { PALETTE } from "@/lib/utils";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  /** Abweichende Palette. Default: die gemeinsame Palette aus `styles/colors`. */
  colors?: readonly string[];
  /** Barrierefreies Label je Feld — bitte lokalisiert übergeben. */
  swatchLabel?: (color: string) => string;
}

/** Farbraster zur Auswahl einer Akzentfarbe (Workspace, Projekt, Label …). */
export function ColorPicker({
  value,
  onChange,
  colors = PALETTE,
  swatchLabel,
}: ColorPickerProps) {
  return (
    <div className={styles.swatches}>
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
