"use client";

import { Icon } from "@iconify/react";
import { useWorkspace } from "@/lib/workspace-context";
import styles from "./issueIcons.module.scss";

/**
 * The status ladder stays inside lucide's circle family so the glyphs line up
 * as a column in the board and list views. Unknown ids fall back to a plain ring.
 */
const STATUS_ICONS: Record<string, string> = {
  backlog: "lucide:circle-dashed",
  todo: "lucide:circle",
  in_progress: "lucide:circle-dot",
  in_review: "lucide:circle-ellipsis",
  done: "lucide:circle-check",
  canceled: "lucide:circle-x",
};

/** Signal bars per level — "urgent" leaves the family on purpose to stand out. */
const PRIORITY_ICONS: Record<number, string> = {
  0: "lucide:ellipsis",
  1: "lucide:signal-low",
  2: "lucide:signal-medium",
  3: "lucide:signal-high",
  4: "lucide:triangle-alert",
};

// ---- Status icon: tinted with the workspace's colour for that status ----
export function StatusIcon({
  status,
  size = 15,
}: {
  status: string;
  size?: number;
}) {
  const { statuses } = useWorkspace();
  const color = statuses.find((x) => x.id === status)?.color ?? "#8a9099";

  return (
    <Icon
      icon={STATUS_ICONS[status] ?? "lucide:circle"}
      width={size}
      color={color}
      className={styles.icon}
      aria-hidden="true"
    />
  );
}

// ---- Priority icon: signal bars ----
export function PriorityIcon({
  priority,
  size = 15,
}: {
  priority: number;
  size?: number;
}) {
  const p = typeof priority === "number" ? priority : 0;
  const tone = p === 0 ? styles.none : p === 4 ? styles.urgent : styles.level;

  return (
    <Icon
      icon={PRIORITY_ICONS[p] ?? PRIORITY_ICONS[0]}
      width={size}
      className={`${styles.icon} ${tone}`}
      aria-hidden="true"
    />
  );
}

// ---- Type icon: geometric glyph per issue type ----
export function TypeIcon({
  type,
  size = 14,
  color,
}: {
  type: string;
  size?: number;
  color?: string;
}) {
  const { issueTypes } = useWorkspace();
  const t = issueTypes.find((x) => x.id === type);
  const c = color ?? t?.color ?? "#686d76";
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    className: styles.icon,
  };

  if (type === "feature")
    return (
      <svg {...common} aria-hidden="true">
        <path d="M8 1.4 14.6 8 8 14.6 1.4 8Z" fill={c} />
      </svg>
    );
  if (type === "bug")
    return (
      <svg {...common} aria-hidden="true">
        <circle cx="8" cy="8" r="5.4" fill="none" stroke={c} strokeWidth="2" />
        <circle cx="8" cy="8" r="1.8" fill={c} />
      </svg>
    );
  if (type === "improvement")
    return (
      <svg {...common} aria-hidden="true">
        <path d="M8 2.2 14.2 13.4H1.8Z" fill={c} />
      </svg>
    );
  if (type === "task")
    return (
      <svg {...common} aria-hidden="true">
        <rect x="2.3" y="2.3" width="11.4" height="11.4" rx="3.2" fill={c} />
        <path
          d="M5.2 8 7.2 10 11 5.8"
          fill="none"
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  // chore / fallback
  return (
    <svg {...common} aria-hidden="true">
      <rect
        x="2.6"
        y="2.6"
        width="10.8"
        height="10.8"
        rx="3"
        fill="none"
        stroke={c}
        strokeWidth="2"
      />
    </svg>
  );
}
