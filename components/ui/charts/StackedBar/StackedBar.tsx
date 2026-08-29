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
  /** Name of the distribution for screen readers and for the table view. */
  label: string;
  /** Heading of the value column in the table view. */
  valueLabel: string;
  asTable?: boolean;
}

/**
 * A bar where all the parts together make up the whole — for a distribution
 * across a few named segments.
 *
 * **A bar instead of a pie.** Both answer the same question, but the bar
 * answers it better: lengths can be compared, angles can't. And it's
 * horizontally narrow where a pie needs square space — on a dashboard that
 * places several cards side by side, that matters.
 *
 * Below the bar sits the legend **with the numbers**, not just the names. A
 * segment can become so narrow that it's no longer clickable; the number
 * next to it is then the only way to get at the value, and it's the only
 * way for anyone reading with a keyboard or a screen reader.
 *
 * Segments with a value of zero don't get a piece of bar — but they do get
 * a row in the legend. That a status is empty is information, and it would
 * otherwise disappear.
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
      {/* The bar itself says nothing the legend below doesn't already say —
          that's why it's hidden from screen readers. Reading out the same
          distribution twice helps nobody. */}
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
                  // `flex-grow` instead of percentage widths: the 2px gaps
                  // between segments would otherwise eat into the 100%, and
                  // the bar would overflow its track on the right.
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
