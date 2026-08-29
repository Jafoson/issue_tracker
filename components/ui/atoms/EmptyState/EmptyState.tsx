import type { ReactNode } from "react";
import styles from "./emptyState.module.scss";

interface EmptyStateProps {
  /**
   * A finished icon element, e.g. `<Icon icon="lucide:users" width={32} />`.
   * Deliberately not an Iconify name: this keeps the placeholder free of
   * client dependencies and usable from Server Components too.
   */
  icon?: ReactNode;
  title: ReactNode;
  /** States how the empty state can be resolved — not just that it's empty. */
  description?: ReactNode;
  /** The first sensible step, usually the same button as in the page header. */
  action?: ReactNode;
  className?: string;
}

/** Placeholder for lists and tables with no content. */
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
