"use client";

import { Icon } from "@iconify/react";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { ReactionPicker } from "@/components/ui/atoms/ReactionPicker/ReactionPicker";
import styles from "./reactionBar.module.scss";

export interface ReactionSummary {
  emoji: string;
  count: number;
  /** Ob der Betrachter selbst mit diesem Emoji reagiert hat — steuert
   *  Hervorhebung und ob ein Klick hinzufügt oder wieder entfernt. */
  reactedByMe: boolean;
}

interface ReactionBarProps {
  reactions: ReactionSummary[];
  /** Fügt hinzu oder entfernt wieder — derselbe Umschalter für Pille und
   *  Picker, das Vorzeichen entscheidet sich am Server über den bestehenden
   *  Zustand. */
  onToggle: (emoji: string) => void;
  addLabel: string;
  searchPlaceholder: string;
}

/**
 * Reaktions-Pillen unter einem Kommentar plus ein „+"-Auslöser, der die volle
 * Auswahl öffnet (`ReactionPicker`). Rein präsentational — Daten und
 * Serveraufruf kommen von außen (`features/issues`).
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
