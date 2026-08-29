"use client";

import { useState } from "react";
import { Input } from "@/components/ui/atoms/Input/Input";
import {
  EMOJI,
  searchEmoji,
} from "@/components/ui/layout/RichTextEditor/extensions/emojiData";
import styles from "./reactionPicker.module.scss";

/** Six common reactions, no need to search first — the same kind of
 *  selection as GitHub/Slack. Anything beyond that sits behind the search field. */
const QUICK_EMOJI = ["👍", "❤️", "😄", "🎉", "👀", "🚀"];

interface ReactionPickerProps {
  onPick: (emoji: string) => void;
  searchPlaceholder: string;
}

/**
 * Emoji picker for reactions: a quick row plus a search field over the full
 * `EMOJI` list (`extensions/emojiData.ts`, otherwise reserved for the `:`
 * trigger in the editor). Purely presentational, no translations of its
 * own — like `LinkForm`, it gets its labels from outside.
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
