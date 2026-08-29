import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/atoms/Button/Button";
import styles from "../modal.module.scss";

interface ModalHeaderProps {
  title: React.ReactNode;
  /** Slot to the left of the title — icon, project badge, avatar … */
  leading?: React.ReactNode;
  /** Extra actions on the right, before the close button. */
  actions?: React.ReactNode;
  /** No close button is rendered without a handler. */
  onClose?: () => void;
  /** Accessible label for the close button — please pass this localized. */
  closeLabel?: string;
  /** Divider below. Default: true. */
  divider?: boolean;
}

/** Modal header: leading slot, title, and close button. */
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
