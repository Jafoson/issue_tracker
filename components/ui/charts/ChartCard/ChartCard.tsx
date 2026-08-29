import type { ReactNode } from "react";
import type { ChartSeries } from "@/components/ui/charts/ColumnChart/ColumnChart";
import styles from "./chartCard.module.scss";

interface Props {
  title: string;
  /** A sentence above explaining what the chart shows. */
  hint?: string;
  /**
   * The series — the legend appears from two onward.
   *
   * With a single series it's omitted: there's only one color, and the
   * heading already says what's being counted. A swatch with one entry
   * would just repeat the title.
   */
  series?: ChartSeries[];
  /** A number next to the title — usually the sum for the period. */
  total?: ReactNode;
  children: ReactNode;
}

/**
 * The frame around a chart: heading, explanation, legend.
 *
 * The legend sits above rather than below — it's read before the chart, not
 * after. It mirrors the mark it explains: a small square for areas and columns.
 */
export function ChartCard({ title, hint, series, total, children }: Props) {
  return (
    <section className={styles.card}>
      <header className={styles.head}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>{title}</h3>
          {total !== undefined && <span className={styles.total}>{total}</span>}
        </div>
        {hint && <p className={styles.hint}>{hint}</p>}

        {series && series.length > 1 && (
          <ul className={styles.legend}>
            {series.map((entry) => (
              <li key={entry.key} className={styles.legendItem}>
                <span
                  className={styles.swatch}
                  style={{ background: entry.color }}
                />
                {entry.label}
              </li>
            ))}
          </ul>
        )}
      </header>

      <div className={styles.body}>{children}</div>
    </section>
  );
}
