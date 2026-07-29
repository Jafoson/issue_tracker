import type { ReactNode } from "react";
import styles from "./emptyState.module.scss";

interface EmptyStateProps {
  /**
   * Fertiges Icon-Element, z. B. `<Icon icon="lucide:users" width={32} />`.
   * Bewusst kein Iconify-Name: so bleibt der Platzhalter frei von
   * Client-Abhängigkeiten und auch aus Server Components nutzbar.
   */
  icon?: ReactNode;
  title: ReactNode;
  /** Sagt, wie sich der Zustand auflösen lässt — nicht nur, dass er leer ist. */
  description?: ReactNode;
  /** Der erste sinnvolle Schritt, meist derselbe Button wie im Seitenkopf. */
  action?: ReactNode;
  className?: string;
}

/** Platzhalter für Listen und Tabellen ohne Inhalt. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={[styles.empty, className].filter(Boolean).join(" ")}>
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.title}>{title}</span>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
