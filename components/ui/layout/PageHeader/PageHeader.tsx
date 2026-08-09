import type { ReactNode } from "react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import styles from "./pageHeader.module.scss";

interface PageHeaderProps {
  title: ReactNode;
  /** Zähler direkt hinter dem Titel — meist die Zeilenzahl der Liste darunter. */
  count?: number;
  /** Ein Satz darüber, was diese Seite verwaltet. */
  description?: ReactNode;
  /** Slot links vom Titel — Icon, Farbpunkt, Avatar … */
  leading?: ReactNode;
  /** Aktionen rechts, in der Regel der Primär-Button der Seite. */
  actions?: ReactNode;
  /**
   * Trennlinie nach unten. Default: true. Aus, wenn der Inhalt darunter seinen
   * eigenen Rahmen mitbringt — zwei Kanten übereinander trennen nichts mehr.
   */
  divider?: boolean;
  className?: string;
}

/**
 * Kopfzeile einer Verwaltungsseite: Titel, Zähler, Beschreibung, Aktionen.
 *
 * Das Gegenstück zur `Topbar` der Issue-Ansichten — die filtert und zählt, das
 * hier benennt nur. Bewusst ohne eigenen Zustand und ohne `"use client"`, damit
 * Server Components es direkt rendern können; interaktive Aktionen kommen als
 * fertige Elemente in den `actions`-Slot.
 */
export function PageHeader({
  title,
  count,
  description,
  leading,
  actions,
  divider = true,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={[styles.header, divider && styles.divider, className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.titleRow}>
        {leading}
        <h1 className={styles.title}>{title}</h1>
        {/* Dasselbe Zeichen wie im Kopf einer Board-Spalte: eine Zahl neben
            einem Titel ist überall in der App ein Badge. */}
        {count !== undefined && <Badge mono>{count}</Badge>}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>

      {description && <p className={styles.description}>{description}</p>}
    </header>
  );
}
