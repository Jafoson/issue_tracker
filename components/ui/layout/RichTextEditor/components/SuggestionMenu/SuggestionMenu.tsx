"use client";

import type { ReactNode, Ref } from "react";
import { useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import styles from "./suggestionMenu.module.scss";

/**
 * Die Liste, die unter `@`, `#`, `:` und `/` aufgeht — eine für alle vier.
 *
 * Was sie zeigt, entscheidet der jeweilige Trigger; sie selbst kennt nur
 * `SuggestionItem`. Bedienung und Aussehen sind bewusst dieselben wie in der
 * `CommandPalette` (↑ ↓ zum Wandern, ↵ zum Wählen), damit sich beides gleich
 * anfühlt.
 *
 * Positioniert wird sie nicht hier, sondern von `props.mount` aus
 * `@tiptap/suggestion` — das hängt sie über Floating UI an den Cursor und hält
 * sie beim Scrollen dort.
 */

export interface SuggestionItem {
  id: string;
  label: string;
  /** Rechts außen, gedämpft — Issue-Schlüssel, Datum, Kurzform. */
  hint?: string;
  /** Links, in der Größe der Zeile. */
  icon?: ReactNode;
  /** Überschrift, unter der die Einträge zusammenstehen. */
  group?: string;
}

/** Was der Editor von außen aufrufen können muss. */
export interface SuggestionMenuHandle {
  /** `true`, wenn die Taste verbraucht wurde und nicht in den Text soll. */
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface SuggestionMenuProps {
  items: SuggestionItem[];
  command: (item: SuggestionItem) => void;
  loading?: boolean;
  /** Steht anstelle der Liste, wenn nichts passt. */
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

  // Nach jeder neuen Trefferliste wieder oben anfangen — der alte Index zeigte
  // auf einen Eintrag, den es nicht mehr gibt.
  const [seen, setSeen] = useState(items);
  if (seen !== items) {
    setSeen(items);
    setCursor(0);
  }

  // Der gewählte Eintrag muss sichtbar bleiben, auch wenn die Liste scrollt.
  useLayoutEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const move = (delta: number) => {
    if (!items.length) return;
    // Umlaufend: von unten geht es oben weiter, wie in der Palette.
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
      // Tab wählt wie Enter — das erwartet, wer aus anderen Editoren kommt.
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

  // Zwei Hüllen, mit Absicht: außen liegt die Rundung, innen wird gescrollt.
  // Auf einem Element zusammen ginge das schief — die Bildlaufleiste wird über
  // den abgerundeten Beschnitt gemalt und macht die rechten Ecken wieder eckig.
  // Das `overflow: hidden` außen beschneidet sie mit.
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
                // Der Fokus muss im Editor bleiben, sonst bricht die Auswahl weg.
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
