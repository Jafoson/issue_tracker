"use client";

import type { ReactNode } from "react";
import styles from "./barList.module.scss";

export interface BarRow {
  id: string;
  label: string;
  value: number;
  /** One line of fine print below the label. */
  meta?: string;
  /** Dot before the label — the color of the object, not of the row. */
  dot?: string;
  /**
   * A finished element right at the front — avatar, icon, color patch.
   *
   * For rows whose subject has a face: a dot in a person's color says less
   * than the person themselves. Stands in place of `dot`, not alongside it —
   * both together would be two markers for the same thing.
   */
  leading?: ReactNode;
}

interface Props {
  rows: BarRow[];
  label: string;
  /** Heading of the value column in the table view. */
  valueLabel: string;
  asTable?: boolean;
}

/**
 * Horizontal bars with the value at the end — for comparing size across a
 * few named things.
 *
 * **One row, one color.** Coloring the bars by their value would be
 * redundant: the length already conveys size, and the color would then be
 * free for nothing else. The dot before the name therefore carries the
 * workspace's color — which the reader recognizes — and the bar itself
 * stays consistently in the first slot.
 *
 * The value appears as a number at the end of each bar. That's not
 * decoration here — it's the reason the list gets away without an axis.
 */
export function BarList({ rows, label, valueLabel, asTable = false }: Props) {
  const max = Math.max(1, ...rows.map((row) => row.value));

  if (asTable) {
    return (
      <table className={styles.table}>
        <caption className={styles.caption}>{label}</caption>
        <thead>
          <tr>
            <th scope="col">{label}</th>
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.label}</th>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <ul className={styles.list} aria-label={label}>
      {rows.map((row) => (
        <li key={row.id} className={styles.row}>
          <span className={styles.head}>
            <span className={styles.name}>
              {row.leading ? (
                <span className={styles.leading}>{row.leading}</span>
              ) : (
                row.dot && (
                  <span
                    className={styles.dot}
                    style={{ background: row.dot }}
                  />
                )
              )}
              <span className={styles.labelText}>{row.label}</span>
            </span>
            <span className={styles.value}>{row.value}</span>
          </span>

          <span className={styles.track}>
            <span
              className={styles.fill}
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </span>

          {row.meta && <span className={styles.meta}>{row.meta}</span>}
        </li>
      ))}
    </ul>
  );
}
