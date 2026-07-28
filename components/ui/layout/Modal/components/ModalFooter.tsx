import styles from "../modal.module.scss";

interface ModalFooterProps {
  /** Linker Slot, meist ein `ModalShortcut`. */
  hint?: React.ReactNode;
  /** Aktionen — werden immer rechtsbündig ausgerichtet. */
  children?: React.ReactNode;
  /** Trennlinie nach oben. Default: true. */
  divider?: boolean;
}

/** Fußzeile eines Modals: Hinweis links, Aktionen rechts. */
export function ModalFooter({
  hint,
  children,
  divider = true,
}: ModalFooterProps) {
  return (
    <div
      className={[styles.footer, divider && styles.dividerAbove]
        .filter(Boolean)
        .join(" ")}
    >
      {hint}
      <div className={styles.footerActions}>{children}</div>
    </div>
  );
}

interface ModalShortcutProps {
  /** Tasten in Anzeigereihenfolge, z.B. `["⌘", "↵"]`. */
  keys: string[];
  /** Beschreibung hinter den Tasten, z.B. „zum Erstellen“. */
  children?: React.ReactNode;
}

/** Tastenkürzel-Hinweis für den `hint`-Slot des `ModalFooter`. */
export function ModalShortcut({ keys, children }: ModalShortcutProps) {
  return (
    <span className={styles.shortcut}>
      {keys.map((key, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: statische Tastenfolge, kann Wiederholungen enthalten
        <kbd key={`${key}-${i}`} className={styles.kbd}>
          {key}
        </kbd>
      ))}
      {children}
    </span>
  );
}
