"use client";

import { useId, useRef, useState } from "react";
import styles from "./columnChart.module.scss";

export interface ChartSeries {
  key: string;
  label: string;
  /** CSS-Farbe der Reihe — aus `--chart-1..3`, in fester Reihenfolge vergeben. */
  color: string;
}

export interface ChartPoint {
  /** Eindeutig je Spalte, zugleich React-Key. */
  key: string;
  /** Volle Beschriftung — im Tooltip und in der Tabelle. */
  label: string;
  /** Kurzform für die Achse. Ohne sie steht dort `label`. */
  short?: string;
  values: Record<string, number>;
}

interface Props {
  series: ChartSeries[];
  points: ChartPoint[];
  /** Name des Diagramms für Screenreader und für die Tabellenansicht. */
  label: string;
  /** Statt der Säulen dieselben Zahlen als Tabelle. */
  asTable?: boolean;
  /** Beschriftung der Wertespalte in der Tabellenansicht. */
  valueLabel?: string;
}

/**
 * Säulen über einer Zeitachse — eine Reihe oder mehrere gestapelt.
 *
 * **Gebaut aus HTML, nicht aus SVG.** Ein SVG mit `viewBox` skaliert seine
 * Schrift mit der Breite mit: dieselbe Achsenbeschriftung wäre auf einem breiten
 * Bildschirm größer als der Fließtext daneben. Die Säulen sind deshalb Kästen mit
 * Prozenthöhen — die Schrift bleibt Schrift, jede Säule ist ein echtes Element
 * mit eigenem Fokus, und die Tastaturbedienung fällt nicht als Nachbau an.
 *
 * Der Umriss der Marken folgt festen Regeln: höchstens 24px dick, oben 4px
 * gerundet und unten auf der Grundlinie eckig, zwischen gestapelten Abschnitten
 * eine 2px-Lücke in der Flächenfarbe statt eines Rahmens. Das Raster ist eine
 * durchgezogene Haarlinie eine Stufe neben der Fläche — gestrichelt läse es sich
 * als Schwelle, die es nicht gibt.
 *
 * ── Bedienung ──
 *
 * Der Zielbereich ist die ganze Spalte, nicht die gemalte Säule: an einem Tag
 * mit einer Aufgabe wäre die Marke sonst drei Pixel hoch. Ein Tooltip zeigt
 * **alle** Reihen dieser Spalte, nicht nur die berührte — wer auf einen Tag
 * zeigt, will den Tag wissen.
 *
 * Die Tastatur wandert mit den Pfeiltasten durch die Spalten und hält dabei nur
 * einen Tab-Halt (`tabIndex`), statt dreißig in die Reihenfolge des Dokuments zu
 * legen. Fokus zeigt denselben Tooltip wie der Zeiger.
 *
 * Der Tooltip ist trotzdem nie der einzige Weg an eine Zahl: `asTable` zeigt
 * dieselben Werte als Tabelle, und die Achse trägt die Größenordnung.
 */
export function ColumnChart({
  series,
  points,
  label,
  asTable = false,
  valueLabel,
}: Props) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const [focused, setFocused] = useState(0);
  const slots = useRef<(HTMLButtonElement | null)[]>([]);

  const total = (point: ChartPoint) =>
    series.reduce((sum, s) => sum + (point.values[s.key] ?? 0), 0);

  // Der Maßstab richtet sich nach der größten Säule, mindestens aber 1 — sonst
  // teilte eine leere Achse durch null.
  const max = Math.max(1, ...points.map(total));

  if (asTable) {
    return (
      <table className={styles.table}>
        <caption className={styles.caption}>{label}</caption>
        <thead>
          <tr>
            <th scope="col">{valueLabel ?? ""}</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.key}>
              <th scope="row">{point.label}</th>
              {series.map((s) => (
                <td key={s.key}>{point.values[s.key] ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const move = (event: React.KeyboardEvent, index: number) => {
    const next =
      event.key === "ArrowRight"
        ? index + 1
        : event.key === "ArrowLeft"
          ? index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? points.length - 1
              : null;
    if (next === null) return;

    event.preventDefault();
    const target = Math.min(Math.max(next, 0), points.length - 1);
    setFocused(target);
    slots.current[target]?.focus();
  };

  const shown = active === null ? null : points[active];

  // Nicht jede Säule bekommt eine Beschriftung — bei dreißig Tagen stünden sie
  // übereinander. Es bleiben höchstens acht, gleichmäßig verteilt.
  //
  // Die letzte ist immer dabei („bis wann" fragt man an einer Zeitachse
  // zuerst), und genau deshalb muss die reguläre Marke davor weichen, wenn sie
  // ihr zu nahe kommt: bei dreißig Tagen fielen sonst Index 28 und 29
  // nebeneinander und überschrieben sich.
  const every = Math.ceil(points.length / 8);
  const last = points.length - 1;

  const tickLabel = (point: ChartPoint, index: number) => {
    if (index === last) return point.short ?? point.label;
    if (index % every !== 0) return "";
    if (last - index <= every / 2) return "";
    return point.short ?? point.label;
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.plotRow}>
        {/* Die Achse trägt nur zwei Marken: den größten Wert und die Null. Mehr
            Zahlen an der Seite erklären nichts, was die Säulen nicht schon
            zeigen — der genaue Wert steht im Tooltip und in der Tabelle. */}
        <div className={styles.yAxis} aria-hidden="true">
          <span>{max}</span>
          <span>0</span>
        </div>

        <div className={styles.plotCol}>
          <div className={styles.plot}>
            <div className={styles.grid} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>

            {/* Ohne eigene Rolle: die Karte um das Diagramm trägt schon eine
              Überschrift (`ChartCard`), und jede Säule sagt ihre Zahlen selbst.
              Eine zweite Gruppierung darüber wiederholte nur den Titel. */}
            <div
              className={styles.slots}
              onPointerLeave={() => setActive(null)}
            >
              {points.map((point, index) => {
                const sum = total(point);
                return (
                  <button
                    type="button"
                    key={point.key}
                    ref={(node) => {
                      slots.current[index] = node;
                    }}
                    className={styles.slot}
                    data-active={active === index || undefined}
                    tabIndex={focused === index ? 0 : -1}
                    aria-describedby={
                      active === index ? `${id}-tip` : undefined
                    }
                    aria-label={`${point.label}: ${series
                      .map((s) => `${point.values[s.key] ?? 0} ${s.label}`)
                      .join(", ")}`}
                    onPointerEnter={() => setActive(index)}
                    onFocus={() => {
                      setFocused(index);
                      setActive(index);
                    }}
                    onBlur={() => setActive(null)}
                    onKeyDown={(event) => move(event, index)}
                  >
                    <span className={styles.bar}>
                      {series.map((s) => {
                        const value = point.values[s.key] ?? 0;
                        if (value === 0) return null;
                        return (
                          <span
                            key={s.key}
                            className={styles.segment}
                            style={{
                              height: `${(value / max) * 100}%`,
                              background: s.color,
                            }}
                          />
                        );
                      })}
                    </span>
                    {/* Ein leerer Topf bekommt eine Grundlinie statt gar nichts —
                      sonst sähe „null Aufgaben" aus wie „kein Tag". */}
                    {sum === 0 && <span className={styles.zero} />}
                  </button>
                );
              })}
            </div>

            {shown && (
              <div
                id={`${id}-tip`}
                role="tooltip"
                className={styles.tip}
                // Links vom Zeiger, sobald die Spalte in der rechten Hälfte liegt:
                // sonst hinge der Kasten über der Kante der Karte.
                data-side={(active ?? 0) > last / 2 ? "start" : "end"}
                style={{
                  left: `${(((active ?? 0) + 0.5) / points.length) * 100}%`,
                }}
              >
                <span className={styles.tipTitle}>{shown.label}</span>
                {series.map((s) => (
                  <span key={s.key} className={styles.tipRow}>
                    <span
                      className={styles.tipKey}
                      style={{ background: s.color }}
                    />
                    <span className={styles.tipValue}>
                      {shown.values[s.key] ?? 0}
                    </span>
                    <span className={styles.tipLabel}>{s.label}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={styles.xAxis} aria-hidden="true">
            {points.map((point, index) => (
              <span key={point.key} className={styles.tick}>
                {tickLabel(point, index)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
