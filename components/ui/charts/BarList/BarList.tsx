"use client";

import type { ReactNode } from "react";
import styles from "./barList.module.scss";

export interface BarRow {
  id: string;
  label: string;
  value: number;
  /** Eine Zeile Kleingedrucktes unter der Beschriftung. */
  meta?: string;
  /** Punkt vor der Beschriftung — die Farbe des Objekts, nicht der Reihe. */
  dot?: string;
  /**
   * Fertiges Element ganz vorn — Avatar, Zeichen, Farbfleck.
   *
   * Für Zeilen, deren Gegenstand ein Gesicht hat: ein Punkt in der Farbe einer
   * Person sagt weniger als die Person selbst. Steht anstelle von `dot`, nicht
   * daneben — beide zusammen wären zwei Kennzeichen für dieselbe Sache.
   */
  leading?: ReactNode;
}

interface Props {
  rows: BarRow[];
  label: string;
  /** Überschrift der Wertespalte in der Tabellenansicht. */
  valueLabel: string;
  asTable?: boolean;
}

/**
 * Waagerechte Balken mit dem Wert am Ende — für einen Vergleich der Größe
 * zwischen wenigen benannten Dingen.
 *
 * **Eine Reihe, eine Farbe.** Die Balken nach ihrem Wert einzufärben wäre
 * doppelt gemoppelt: die Länge sagt die Größe schon, und die Farbe wäre danach
 * für nichts anderes mehr frei. Der Punkt vor dem Namen trägt deshalb die Farbe
 * des Workspace — die kennt der Leser wieder — und der Balken selbst bleibt
 * durchgehend im ersten Steckplatz.
 *
 * Der Wert steht als Zahl am Ende jedes Balkens. Das ist hier kein Beiwerk,
 * sondern der Grund, warum die Liste ohne Achse auskommt.
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
