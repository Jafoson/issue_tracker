import { Icon } from "@iconify/react";
import styles from "./label.module.scss";

interface LabelProps {
  color?: string;
  size?: "xs" | "sm" | "md";
  filled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  hasIcon?: boolean;
  /** Explains what the label stands for on hover. */
  title?: string;
  /**
   * Attaches a remove cross. Without the callback the label stays purely
   * for display — most places only show it, they don't let it be edited there.
   */
  onRemove?: () => void;
  /** Accessible name of the cross — pass it in localized. */
  removeLabel?: string;
}

export function Label({
  color,
  size = "md",
  className,
  style,
  children,
  hasIcon,
  filled,
  title,
  onRemove,
  removeLabel = "Remove",
}: LabelProps) {
  return (
    <span
      title={title}
      className={[
        styles.label,
        // "md" is the base style and deliberately has no modifier class.
        styles[size],
        filled && styles.filled,
        onRemove && styles.removable,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--label-color": color, ...style } as React.CSSProperties}
    >
      {color && !hasIcon && (
        <span className={styles.dot} style={{ background: color }} />
      )}
      {children}

      {onRemove && (
        <button
          type="button"
          className={styles.remove}
          aria-label={removeLabel}
          title={removeLabel}
          // The label itself can be clickable (filter, selection) — the
          // cross only means itself.
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          <Icon icon="lucide:x" width={11} />
        </button>
      )}
    </span>
  );
}
