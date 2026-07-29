"use client";

import { PALETTE } from "@/lib/utils";
import styles from "./colorPicker.module.scss";

interface ColorPickerProps {
  /** Aktuell gewählte Farbe. Entfällt, wenn die Auswahl direkt eine Aktion auslöst. */
  value?: string;
  onChange: (color: string) => void;
  /** Abweichende Palette. Default: die gemeinsame Palette aus `lib/utils/color`. */
  colors?: readonly string[];
  /** `sm` für Popover/Menüs, `md` (Default) für Formulare und Modals. */
  size?: "sm" | "md";
  /** Barrierefreies Label je Feld — bitte lokalisiert übergeben. */
  swatchLabel?: (color: string) => string;
}

/** Farbraster zur Auswahl einer Akzentfarbe (Workspace, Projekt, Label …). */
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
