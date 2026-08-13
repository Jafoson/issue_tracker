"use client";

import { RANGES, type RangeKey } from "@/lib/buckets";
import styles from "./rangePicker.module.scss";

interface Props {
  value: RangeKey;
  onChange: (range: RangeKey) => void;
  /** Barrierefreier Name der Gruppe, z. B. „Zeitraum". */
  label: string;
  /** Beschriftung je Zeitraum — die Übersetzung kommt von außen herein. */
  labelFor: (range: RangeKey) => string;
}

/**
 * Der Zeitraum eines Dashboards: vier Knöpfe, ein Wert.
 *
 * Ein `fieldset`, weil es genau das ist — mehrere Knöpfe, die zusammen einen
 * Wert setzen. Die Beschriftung kommt per `aria-label` statt als sichtbare
 * Legende: die Knöpfe sagen selbst, worum es geht.
 *
 * Bewusst kein `SegmentedControl`: das ist ein Umschalter zwischen Ansichten
 * und trägt den Akzent der Anwendung. Der Zeitraum ist eine Einstellung *über*
 * dem Inhalt, keine Ansicht davon — er tritt zurück und markiert nur, was
 * gerade gilt.
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
