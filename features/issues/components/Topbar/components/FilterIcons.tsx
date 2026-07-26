import type { Label } from "@/types";
import styles from "../topbar.module.scss";

/**
 * Neutral stand-ins shown on a filter chip when several values are selected and
 * no single icon can represent the selection.
 */

export function MultiStatusIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={styles.glyph}
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="6.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity=".6"
      />
    </svg>
  );
}

export function MultiPriorityIcon({ size = 14 }: { size?: number }) {
  const bars = [
    { x: 2.5, y: 9, h: 5 },
    { x: 6.5, y: 6, h: 8 },
    { x: 10.5, y: 3, h: 11 },
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={styles.glyph}
      aria-hidden="true"
    >
      {bars.map((b) => (
        <rect
          key={b.x}
          x={b.x}
          y={b.y}
          width="3"
          height={b.h}
          rx="1"
          fill="currentColor"
          opacity=".45"
        />
      ))}
    </svg>
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
