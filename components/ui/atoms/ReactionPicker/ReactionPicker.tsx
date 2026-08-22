"use client";

import { useState } from "react";
import { Input } from "@/components/ui/atoms/Input/Input";
import {
  EMOJI,
  searchEmoji,
} from "@/components/ui/layout/RichTextEditor/extensions/emojiData";
import styles from "./reactionPicker.module.scss";

/** Sechs gängige Reaktionen, ohne erst zu suchen — dieselbe Sorte Auswahl wie
 *  bei GitHub/Slack. Alles darüber hinaus liegt hinter dem Suchfeld. */
const QUICK_EMOJI = ["👍", "❤️", "😄", "🎉", "👀", "🚀"];

interface ReactionPickerProps {
  onPick: (emoji: string) => void;
  searchPlaceholder: string;
}

/**
 * Emoji-Auswahl für Reaktionen: eine Schnellzeile plus Suchfeld über die
 * volle `EMOJI`-Liste (`extensions/emojiData.ts`, sonst nur dem `:`-Trigger
 * im Editor vorbehalten). Reine Präsentation, keine Übersetzungen selbst —
 * wie `LinkForm` bekommt sie ihre Beschriftung von außen.
 */
export function ReactionPicker({
  onPick,
  searchPlaceholder,
}: ReactionPickerProps) {
  const [query, setQuery] = useState("");
  const results = query.trim() ? searchEmoji(query, EMOJI.length) : EMOJI;

  return (
    <div className={styles.picker}>
      <div className={styles.quickRow}>
        {QUICK_EMOJI.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className={styles.quickOption}
            onClick={() => onPick(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>

      <Input
        size="sm"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        autoFocus
      />

      <div className={styles.grid}>
        {results.map((entry) => (
          <button
            key={entry.name}
            type="button"
            className={styles.gridOption}
            title={entry.name}
            onClick={() => onPick(entry.emoji)}
          >
            {entry.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
