"use client";

import styles from "./switch.module.scss";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /**
   * What the switch controls — visible next to it, or, in a table with
   * column headers, screen-reader only (`labelHidden`).
   */
  label: string;
  labelHidden?: boolean;
  disabled?: boolean;
  id?: string;
}

/**
 * A two-state switch: on or off, effective immediately.
 *
 * It deliberately has no "Save" — a switch whose position only takes effect
 * after pressing a button shows something incorrect in the meantime.
 * Whoever sets it writes in the same motion.
 *
 * Underneath sits a real checkbox: keyboard, focus, and screen reader
 * support all come from it, only the track with the knob on top is visible.
 * `role="switch"` announces "on/off" rather than "selected/not selected" —
 * same element, the more fitting announcement.
 */
export function Switch({
  checked,
  onChange,
  label,
  labelHidden = false,
  disabled = false,
  id,
}: SwitchProps) {
  return (
    <label className={styles.root} data-disabled={disabled || undefined}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        // Belt and braces: the checkbox already carries its state on its
        // own. `role="switch"` still expects it explicitly per ARIA, and
        // the two can't contradict each other — they come from the same prop.
        aria-checked={checked}
        className={styles.input}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.track} aria-hidden>
        <span className={styles.knob} />
      </span>
      <span className={labelHidden ? styles.hiddenLabel : styles.label}>
        {label}
      </span>
    </label>
  );
}
