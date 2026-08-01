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
  /** Erklärt beim Überfahren, wofür das Label steht. */
  title?: string;
  /**
   * Hängt ein Kreuz zum Entfernen an. Ohne den Rückruf bleibt das Label reine
   * Anzeige — die meisten Stellen zeigen es nur, ändern lässt es sich dort
   * nicht.
   */
  onRemove?: () => void;
  /** Barrierefreier Name des Kreuzes — bitte lokalisiert übergeben. */
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
        // "md" ist der Basis-Stil und hat bewusst keine Modifier-Klasse.
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
          // Das Label selbst kann anklickbar sein (Filter, Auswahl) — das
          // Kreuz meint nur sich.
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
