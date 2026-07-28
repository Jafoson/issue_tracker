import { Icon } from "@iconify/react";
import styles from "../topbar.module.scss";

/**
 * Neutral stand-ins shown on a filter chip when several values are selected and
 * no single icon can represent the selection.
 */

export function MultiStatusIcon({ size = 14 }: { size?: number }) {
  return (
    <Icon
      icon="lucide:circle-pile"
      width={size}
      className={styles.glyphMuted}
      aria-hidden="true"
    />
  );
}

export function MultiPriorityIcon({ size = 14 }: { size?: number }) {
  return (
    <Icon
      icon="lucide:chart-no-axes-column-increasing"
      width={size}
      className={styles.glyphMuted}
      aria-hidden="true"
    />
  );
}
