"use client";

import { Icon } from "@iconify/react";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { ReactionPicker } from "@/components/ui/atoms/ReactionPicker/ReactionPicker";
import styles from "./reactionBar.module.scss";

export interface ReactionSummary {
  emoji: string;
  count: number;
  /** Whether the viewer themselves reacted with this emoji — controls
   *  highlighting and whether a click adds or removes it again. */
  reactedByMe: boolean;
}

interface ReactionBarProps {
  reactions: ReactionSummary[];
  /** Adds or removes again — the same toggle for both the pill and the
   *  picker; the sign is decided on the server based on existing state. */
  onToggle: (emoji: string) => void;
  addLabel: string;
  searchPlaceholder: string;
}

/**
 * Reaction pills below a comment plus a "+" trigger that opens the full
 * picker (`ReactionPicker`). Purely presentational — data and the server
 * call come from outside (`features/issues`).
 */
export function ReactionBar({
  reactions,
  onToggle,
  addLabel,
  searchPlaceholder,
}: ReactionBarProps) {
  return (
    <div className={styles.bar}>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          className={styles.pill}
          data-active={r.reactedByMe ? "" : undefined}
          onClick={() => onToggle(r.emoji)}
        >
          <span>{r.emoji}</span>
          <span className={styles.count}>{r.count}</span>
        </button>
      ))}

      <InlinePicker
        width={220}
        stop
        trigger={
          <button
            type="button"
            className={styles.add}
            aria-label={addLabel}
            title={addLabel}
          >
            <Icon icon="lucide:smile-plus" width={14} />
          </button>
        }
      >
        {(close) => (
          <ReactionPicker
            searchPlaceholder={searchPlaceholder}
            onPick={(emoji) => {
              close();
              onToggle(emoji);
            }}
          />
        )}
      </InlinePicker>
    </div>
  );
}
