import type { ReactNode } from "react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import styles from "./pageHeader.module.scss";

interface PageHeaderProps {
  title: ReactNode;
  /** Counter right after the title — usually the row count of the list below. */
  count?: number;
  /** One sentence about what this page manages. */
  description?: ReactNode;
  /** Slot to the left of the title — icon, color dot, avatar … */
  leading?: ReactNode;
  /** Actions on the right, usually the page's primary button. */
  actions?: ReactNode;
  /**
   * Divider below. Default: true. Off when the content below brings its own
   * border — two edges stacked no longer separate anything.
   */
  divider?: boolean;
  className?: string;
}

/**
 * Header of a management page: title, counter, description, actions.
 *
 * The counterpart to the `Topbar` of the issue views — that one filters and
 * counts, this one only labels. Deliberately without its own state and
 * without `"use client"`, so Server Components can render it directly;
 * interactive actions come in as finished elements via the `actions` slot.
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
        {/* Same convention as a board column's header: a number next to a
            title is a badge everywhere in the app. */}
        {count !== undefined && <Badge mono>{count}</Badge>}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>

      {description && <p className={styles.description}>{description}</p>}
    </header>
  );
}
