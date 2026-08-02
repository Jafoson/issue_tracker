"use client";

import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import styles from "./editableText.module.scss";

interface EditableTextProps {
  value: string;
  /** Läuft beim Verlassen des Feldes — und nur, wenn sich etwas geändert hat. */
  onCommit: (value: string) => void;
  /** Barrierefreier Name: das Feld sieht aus wie Text, hat also kein Label. */
  label: string;
  placeholder?: string;
  /**
   * Einzeiler: Enter schickt ab statt umzubrechen, und ein leerer Wert wird
   * verworfen — für Felder, die nicht leer sein dürfen (z.B. ein Titel).
   */
  singleLine?: boolean;
  /**
   * Beim Einblenden gleich schreibbereit. Für Felder, die erst auf Zuruf
   * erscheinen (Bearbeiten-Knopf) — wer eines aufklappt, will nicht erst
   * hineinklicken.
   */
  autoFocus?: boolean;
  /** Beschriftungen der beiden Knöpfe — bitte lokalisiert übergeben. */
  saveLabel?: string;
  cancelLabel?: string;
  /** Typografie des umgebenden Texts — Feld und Zwilling erben sie. */
  className?: string;
}

/**
 * Text, der aussieht wie Text und sich anfassen lässt wie ein Feld: kein
 * Bearbeiten-Modus, kein Speichern-Zwang. Übernommen wird beim Verlassen des
 * Feldes, mit Enter (bzw. ⌘/Strg + Enter mehrzeilig) oder über den Haken;
 * verworfen mit Escape oder dem Kreuz.
 *
 * Die Höhe wächst über einen unsichtbaren Zwilling im selben Grid mit — reine
 * CSS-Lösung, damit niemand Zeilenhöhen in JavaScript nachrechnen muss.
 */
export function EditableText({
  value,
  onCommit,
  label,
  placeholder,
  singleLine,
  autoFocus,
  saveLabel = "Save",
  cancelLabel = "Cancel",
  className,
}: EditableTextProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(value);
  const [source, setSource] = useState(value);
  const [isEditing, setIsEditing] = useState(false);
  // Verwerfen läuft immer über `blur()`, und das feuert synchron — ohne die
  // Notiz würde der Weg im Blur-Handler als Übernehmen enden.
  const isCanceling = useRef(false);

  // Ein neuer Wert von außen gewinnt (gespeichert oder von jemand anderem
  // geändert). Angleich beim Rendern statt per Effekt: React verwirft den
  // angefangenen Durchlauf und rendert direkt mit dem neuen Stand weiter.
  // Während getippt wird bleibt er außen vor — sonst überschreibt eine gerade
  // eintreffende Antwort die nächsten Tastenanschläge.
  if (!isEditing && source !== value) {
    setSource(value);
    setDraft(value);
  }

  const cancel = () => {
    isCanceling.current = true;
    inputRef.current?.blur();
  };

  /**
   * Der Fokus lässt sich nur am Element selbst setzen — dafür gibt es keinen
   * Weg im Rendern. Der Cursor landet am Ende statt alles zu markieren:
   * ergänzen ist der häufigere Fall als ersetzen.
   */
  useEffect(() => {
    if (!autoFocus) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, [autoFocus]);

  /**
   * Escape darf hier nicht bis zum Modal durchschlagen, sonst schließt sich
   * beim Verwerfen gleich das ganze Panel. Am `window` mit Capture, damit es
   * vor dem Handler des ModalContext (auf `document`) liegt.
   */
  useEffect(() => {
    if (!isEditing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      isCanceling.current = true;
      inputRef.current?.blur();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isEditing]);

  const commit = () => {
    setIsEditing(false);
    if (isCanceling.current) {
      isCanceling.current = false;
      setDraft(value);
      return;
    }
    const next = singleLine ? draft.trim() : draft;
    if (singleLine && !next) {
      setDraft(value);
      return;
    }
    setDraft(next);
    if (next !== value) onCommit(next);
  };

  /**
   * Beide Knöpfe arbeiten über denselben Weg wie Tastatur und Klick daneben:
   * `blur()` löst das Übernehmen aus. Das unterdrückte Mousedown hält den Fokus
   * so lange im Feld, bis der Klick durch ist — sonst wären die Knöpfe schon
   * weg, bevor sie etwas auslösen könnten.
   */
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className={[styles.wrap, className].filter(Boolean).join(" ")}>
      <div className={styles.field} data-value={draft}>
        <textarea
          ref={inputRef}
          className={styles.input}
          aria-label={label}
          placeholder={placeholder}
          value={draft}
          rows={1}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setIsEditing(true)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (singleLine || e.metaKey || e.ctrlKey) {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      </div>

      {isEditing && (
        <div className={styles.actions}>
          <Button
            variant="ghost"
            size="sm"
            tabIndex={-1}
            icon={<Icon icon="lucide:x" width={15} />}
            aria-label={cancelLabel}
            title={cancelLabel}
            onMouseDown={keepFocus}
            onClick={cancel}
          />
          <Button
            variant="primary"
            size="sm"
            tabIndex={-1}
            icon={<Icon icon="lucide:check" width={15} />}
            aria-label={saveLabel}
            title={saveLabel}
            onMouseDown={keepFocus}
            onClick={() => inputRef.current?.blur()}
          />
        </div>
      )}
    </div>
  );
}
