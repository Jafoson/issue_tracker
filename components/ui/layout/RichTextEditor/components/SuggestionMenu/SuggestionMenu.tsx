"use client";

import type { ReactNode, Ref } from "react";
import { useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import styles from "./suggestionMenu.module.scss";

/**
 * The list that pops up under `@`, `#`, `:`, and `/` — one for all four.
 *
 * What it shows is decided by the respective trigger; it itself only knows
 * `SuggestionItem`. Operation and appearance are deliberately the same as in
 * the `CommandPalette` (↑ ↓ to navigate, ↵ to select), so both feel
 * consistent.
 *
 * It isn't positioned here but by `props.mount` from `@tiptap/suggestion` —
 * that attaches it to the cursor via Floating UI and keeps it there while
 * scrolling.
 */

export interface SuggestionItem {
  id: string;
  label: string;
  /** Far right, muted — issue key, date, short form. */
  hint?: string;
  /** On the left, sized to match the row. */
  icon?: ReactNode;
  /** Heading under which entries are grouped together. */
  group?: string;
}

/** What the editor needs to be able to call from outside. */
export interface SuggestionMenuHandle {
  /** `true` when the key was consumed and shouldn't go into the text. */
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface SuggestionMenuProps {
  items: SuggestionItem[];
  command: (item: SuggestionItem) => void;
  loading?: boolean;
  /** Shown in place of the list when nothing matches. */
  emptyLabel: string;
  ref?: Ref<SuggestionMenuHandle>;
}

export function SuggestionMenu({
  items,
  command,
  loading,
  emptyLabel,
  ref,
}: SuggestionMenuProps) {
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Start over at the top with every new result list — the old index would
  // point to an entry that no longer exists.
  const [seen, setSeen] = useState(items);
  if (seen !== items) {
    setSeen(items);
    setCursor(0);
  }

  // The selected entry must stay visible even when the list scrolls.
  useLayoutEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const move = (delta: number) => {
    if (!items.length) return;
    // Wraps around: from the bottom it continues at the top, like in the palette.
    setCursor((c) => (c + delta + items.length) % items.length);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (event.key === "ArrowDown") {
        move(1);
        return true;
      }
      if (event.key === "ArrowUp") {
        move(-1);
        return true;
      }
      // Tab selects like Enter — that's what people coming from other editors expect.
      if (event.key === "Enter" || event.key === "Tab") {
        const item = items[cursor];
        if (!item) return false;
        command(item);
        return true;
      }
      return false;
    },
  }));

  if (loading) {
    return (
      <div className={styles.menu}>
        <div className={styles.empty}>…</div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className={styles.menu}>
        <div className={styles.empty}>{emptyLabel}</div>
      </div>
    );
  }

  let lastGroup: string | undefined;

  // Two wrappers, deliberately: the outer one holds the rounding, the inner
  // one scrolls. Combined on a single element this would go wrong — the
  // scrollbar gets painted over the rounded clip and makes the right corners
  // square again. The outer `overflow: hidden` clips it along with everything else.
  return (
    <div className={styles.menu}>
      <div className={styles.list} ref={listRef} role="listbox">
        {items.map((item, index) => {
          const heading =
            item.group && item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;

          return (
            <div key={item.id}>
              {heading && <div className={styles.groupLabel}>{heading}</div>}
              <button
                type="button"
                role="option"
                aria-selected={index === cursor}
                data-index={index}
                className={`${styles.row}${index === cursor ? ` ${styles.active}` : ""}`}
                // Focus must stay in the editor, otherwise the selection breaks.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setCursor(index)}
                onClick={() => command(item)}
              >
                {item.icon && <span className={styles.icon}>{item.icon}</span>}
                <span className={styles.label}>{item.label}</span>
                {item.hint && <span className={styles.hint}>{item.hint}</span>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
