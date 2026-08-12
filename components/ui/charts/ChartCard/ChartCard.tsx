import type { ReactNode } from "react";
import type { ChartSeries } from "@/components/ui/charts/ColumnChart/ColumnChart";
import styles from "./chartCard.module.scss";

interface Props {
  title: string;
  /** Ein Satz darüber, was das Diagramm zeigt. */
  hint?: string;
  /**
   * Die Reihen — ab zwei erscheint die Legende.
   *
   * Bei einer Reihe entfällt sie: es gibt nur eine Farbe, und die Überschrift
   * sagt schon, was gezählt wird. Ein Kästchen mit einem Eintrag wiederholte
   * bloß den Titel.
   */
  series?: ChartSeries[];
  /** Eine Zahl neben dem Titel — meist die Summe des Zeitraums. */
  total?: ReactNode;
  children: ReactNode;
}

/**
 * Der Rahmen um ein Diagramm: Überschrift, Erklärung, Legende.
 *
 * Die Legende steht oben und nicht unten — sie wird vor dem Diagramm gelesen,
 * nicht danach. Sie spiegelt die Marke, die sie erklärt: ein Kästchen für
 * Flächen und Säulen.
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
