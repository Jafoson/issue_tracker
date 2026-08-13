"use client";

import styles from "./stackedBar.module.scss";

export interface StackSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: StackSegment[];
  /** Name der Verteilung für Screenreader und für die Tabellenansicht. */
  label: string;
  /** Überschrift der Wertespalte in der Tabellenansicht. */
  valueLabel: string;
  asTable?: boolean;
}

/**
 * Ein Balken, in dem alle Teile zusammen das Ganze ergeben — für eine
 * Verteilung über wenige benannte Abschnitte.
 *
 * **Ein Balken statt eines Kreises.** Beide beantworten dieselbe Frage, aber der
 * Balken beantwortet sie besser: Längen lassen sich vergleichen, Winkel nicht.
 * Und er ist waagerecht schmal, wo ein Kreis quadratisch Platz braucht — auf
 * einem Dashboard, das mehrere Karten nebeneinander stellt, entscheidet das.
 *
 * Unter dem Balken steht die Legende **mit den Zahlen**, nicht nur mit den
 * Namen. Ein Abschnitt kann so schmal werden, dass man ihn nicht mehr trifft;
 * die Zahl daneben ist dann der einzige Weg an den Wert, und sie ist es für
 * jeden, der mit der Tastatur oder einem Screenreader liest.
 *
 * Abschnitte mit dem Wert null bekommen kein Stück Balken — wohl aber eine
 * Zeile in der Legende. Dass ein Status leer ist, ist eine Auskunft, und sie
 * verschwände sonst.
 */
export function StackedBar({
  segments,
  label,
  valueLabel,
  asTable = false,
}: Props) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

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
          {segments.map((segment) => (
            <tr key={segment.id}>
              <th scope="row">{segment.label}</th>
              <td>{segment.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className={styles.wrap}>
      {/* Der Balken selbst sagt nichts, was die Legende darunter nicht sagt —
          deshalb ist er für Screenreader nicht vorhanden. Zweimal dieselbe
          Verteilung vorzulesen hilft niemandem. */}
      <div className={styles.bar} aria-hidden="true">
        {total === 0 ? (
          <span className={styles.empty} />
        ) : (
          segments
            .filter((segment) => segment.value > 0)
            .map((segment) => (
              <span
                key={segment.id}
                className={styles.segment}
                style={{
                  // `flex-grow` statt Prozentbreiten: die 2px-Lücken zwischen
                  // den Stücken gingen sonst von 100 % ab, und der Balken
                  // liefe rechts über seine Spur hinaus.
                  flexGrow: segment.value,
                  background: segment.color,
                }}
                title={`${segment.label}: ${segment.value}`}
              />
            ))
        )}
      </div>

      <ul className={styles.legend} aria-label={label}>
        {segments.map((segment) => (
          <li key={segment.id} className={styles.item}>
            <span
              className={styles.swatch}
              style={{ background: segment.color }}
            />
            <span className={styles.name}>{segment.label}</span>
            <span className={styles.value}>{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
