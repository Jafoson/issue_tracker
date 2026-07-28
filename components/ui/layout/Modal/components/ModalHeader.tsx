import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/atoms/Button/Button";
import styles from "../modal.module.scss";

interface ModalHeaderProps {
  title: React.ReactNode;
  /** Slot links vom Titel — Icon, Projekt-Badge, Avatar … */
  leading?: React.ReactNode;
  /** Zusätzliche Aktionen rechts, vor dem Schließen-Button. */
  actions?: React.ReactNode;
  /** Ohne Handler wird kein Schließen-Button gerendert. */
  onClose?: () => void;
  /** Barrierefreies Label des Schließen-Buttons — bitte lokalisiert übergeben. */
  closeLabel?: string;
  /** Trennlinie nach unten. Default: true. */
  divider?: boolean;
}

/** Kopfzeile eines Modals: Leading-Slot, Titel und Schließen-Button. */
export function ModalHeader({
  title,
  leading,
  actions,
  onClose,
  closeLabel = "Close",
  divider = true,
}: ModalHeaderProps) {
  return (
    <div
      className={[styles.header, divider && styles.dividerBelow]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.headerMain}>
        {leading}
        <span className={styles.headerTitle}>{title}</span>
      </div>

      <div className={styles.headerActions}>
        {actions}
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon icon="lucide:x" width={15} />}
            aria-label={closeLabel}
            title={closeLabel}
            onClick={onClose}
          />
        )}
      </div>
    </div>
  );
}
