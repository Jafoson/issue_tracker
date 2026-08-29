"use client";

import { useId, useRef, useState } from "react";
import styles from "./columnChart.module.scss";

export interface ChartSeries {
  key: string;
  label: string;
  /** CSS color of the series — from `--chart-1..3`, assigned in a fixed order. */
  color: string;
}

export interface ChartPoint {
  /** Unique per column, also the React key. */
  key: string;
  /** Full label — used in the tooltip and in the table. */
  label: string;
  /** Short form for the axis. Without it, `label` is shown there. */
  short?: string;
  values: Record<string, number>;
}

interface Props {
  series: ChartSeries[];
  points: ChartPoint[];
  /** Name of the chart for screen readers and for the table view. */
  label: string;
  /** Show the same numbers as a table instead of the columns. */
  asTable?: boolean;
  /** Label of the value column in the table view. */
  valueLabel?: string;
}

/**
 * Columns over a time axis — one series or several stacked.
 *
 * **Built from HTML, not SVG.** An SVG with `viewBox` scales its text along
 * with the width: the same axis label would be larger than the surrounding
 * running text on a wide screen. The columns are therefore boxes with
 * percentage heights — text stays text, every column is a real element with
 * its own focus, and keyboard support doesn't have to be reimplemented.
 *
 * The marks' outline follows fixed rules: at most 24px thick, rounded 4px on
 * top and square at the baseline on the bottom, a 2px gap in the surface
 * color between stacked segments instead of a border. The grid is a solid
 * hairline one step off from the surface — dashed would read as a threshold
 * that doesn't exist.
 *
 * ── Interaction ──
 *
 * The hit target is the whole column, not the drawn bar: on a day with one
 * task, the mark would otherwise be three pixels tall. A tooltip shows
 * **all** series for that column, not just the one touched — whoever points
 * at a day wants to know about the day.
 *
 * The keyboard moves through the columns with the arrow keys and holds only
 * one tab stop (`tabIndex`), instead of putting thirty into document order.
 * Focus shows the same tooltip as the pointer.
 *
 * The tooltip is still never the only way to get at a number: `asTable`
 * shows the same values as a table, and the axis carries the order of magnitude.
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

  // The scale follows the tallest column, but at least 1 — otherwise an
  // empty axis would divide by zero.
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

  // Not every column gets a label — at thirty days they'd overlap. At most
  // eight remain, evenly distributed.
  //
  // The last one is always included ("up to when" is the first thing you
  // ask of a time axis), and that's exactly why the regular mark before it
  // must yield if it gets too close: at thirty days, index 28 and 29 would
  // otherwise land next to each other and overwrite one another.
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
        {/* The axis carries only two marks: the highest value and zero. More
            numbers on the side wouldn't explain anything the columns don't
            already show — the exact value is in the tooltip and the table. */}
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

            {/* No role of its own: the card around the chart already carries
              a heading (`ChartCard`), and every column states its own
              numbers. A second grouping on top would just repeat the title. */}
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
                    {/* An empty bucket gets a baseline mark instead of nothing at
                      all — otherwise "zero tasks" would look like "no day". */}
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
                // To the left of the pointer as soon as the column is in the
                // right half: otherwise the box would hang past the card's edge.
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
