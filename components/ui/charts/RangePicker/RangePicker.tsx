"use client";

import { RANGES, type RangeKey } from "@/lib/buckets";
import styles from "./rangePicker.module.scss";

interface Props {
  value: RangeKey;
  onChange: (range: RangeKey) => void;
  /** Accessible name of the group, e.g. "Time range". */
  label: string;
  /** Label per range — the translation comes in from outside. */
  labelFor: (range: RangeKey) => string;
}

/**
 * The time range of a dashboard: four buttons, one value.
 *
 * A `fieldset` because that's exactly what it is — several buttons that
 * together set one value. The label comes via `aria-label` instead of a
 * visible legend: the buttons themselves say what it's about.
 *
 * Deliberately not a `SegmentedControl`: that's a toggle between views and
 * carries the app's accent color. The time range is a setting *above* the
 * content, not a view of it — it recedes and only marks what currently applies.
 */
export function RangePicker({ value, onChange, label, labelFor }: Props) {
  return (
    <fieldset className={styles.ranges} aria-label={label}>
      {RANGES.map((range) => (
        <button
          key={range}
          type="button"
          className={styles.range}
          data-active={value === range || undefined}
          aria-pressed={value === range}
          onClick={() => onChange(range)}
        >
          {labelFor(range)}
        </button>
      ))}
    </fieldset>
  );
}
