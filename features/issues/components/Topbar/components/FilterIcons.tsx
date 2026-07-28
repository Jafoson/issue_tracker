import { Icon } from "@iconify/react";
import type { Label } from "@/types";
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

/** Up to three colored dots standing in for the selected labels. */
export function LabelDots({ labels }: { labels: Label[] }) {
  return (
    <span className={styles.labelDots}>
      {labels.slice(0, 3).map((l) => (
        <span
          key={l.id}
          className={styles.labelDot}
          style={{ background: l.color }}
        />
      ))}
    </span>
  );
}
