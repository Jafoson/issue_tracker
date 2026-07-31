"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";
import styles from "./linkForm.module.scss";

/**
 * Die Adresszeile für einen Link.
 *
 * Ersetzt das `window.prompt`, das der Knopf in der Werkzeugleiste bisher
 * benutzt hat: das blockiert den Browser, lässt sich nicht gestalten und zeigt
 * je nach System eine andere Beschriftung.
 *
 * Positioniert wird sie wie das Kalenderblatt — vom Aufrufer an den Cursor
 * gehängt.
 */

/**
 * Macht aus einer Eingabe eine brauchbare Adresse.
 *
 * Wer einen Link setzt, tippt selten das Schema mit. Fehlt es, wird `https://`
 * ergänzt — außer bei den Formen, die auch ohne eindeutig sind: eine
 * Mailadresse, ein Pfad innerhalb der Anwendung, ein Sprungziel.
 *
 * Alles, was danach kein erlaubtes Schema trägt, gilt als unbrauchbar. Damit
 * kommt `javascript:` gar nicht erst ins Dokument — dieselbe Linie wie in
 * `RichText`, nur eine Ebene früher.
 */
export function toHref(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  if (/^(?:https?:\/\/|mailto:|\/|#)/i.test(value)) return value;
  // Ein `@` ohne Schema ist eine Mailadresse.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
  // Ein anderes Schema (`javascript:`, `data:`) wird nicht ergänzt, sondern
  // abgelehnt — sonst entstünde daraus `https://javascript:…`.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;

  return `https://${value}`;
}

interface LinkFormProps {
  /** Vorbelegung — die Adresse eines Links, auf dem der Cursor schon steht. */
  initial?: string;
  /** Vorbelegung des Namens. */
  initialName?: string;
  /**
   * Ob nach einem Namen gefragt wird. Aus, wenn Text markiert ist — der ist
   * dann der Name, und ein zweites Feld führte nur in die Irre.
   */
  withName?: boolean;
  onSubmit: (href: string, name: string) => void;
  /** Nimmt den Link von der Auswahl. Fehlt, wenn es noch keinen gibt. */
  onRemove?: () => void;
  onCancel: () => void;
  label: string;
  placeholder: string;
  nameLabel: string;
  namePlaceholder: string;
  applyLabel: string;
  removeLabel: string;
}

export function LinkForm({
  initial = "",
  initialName = "",
  withName = false,
  onSubmit,
  onRemove,
  onCancel,
  label,
  placeholder,
  nameLabel,
  namePlaceholder,
  applyLabel,
  removeLabel,
}: LinkFormProps) {
  const [value, setValue] = useState(initial);
  const [name, setName] = useState(initialName);
  const href = toHref(value);

  const submit = () => {
    if (href) onSubmit(href, name.trim());
  };

  /** Enter übernimmt, Escape bricht ab — in beiden Feldern gleich. */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
    // Nicht bis zum Modal durchlassen — sonst schlösse sich das Panel.
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <div className={styles.form}>
      <div className={styles.row}>
        <Icon icon="lucide:link" width={15} className={styles.icon} />
        <input
          // biome-ignore lint/a11y/noAutofocus: die Zeile geht auf Wunsch auf, der Fokus gehört sofort hinein
          autoFocus
          type="url"
          inputMode="url"
          className={styles.input}
          aria-label={label}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
        />

        {onRemove && (
          <button
            type="button"
            className={styles.action}
            aria-label={removeLabel}
            title={removeLabel}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onRemove}
          >
            <Icon icon="lucide:link-2-off" width={15} />
          </button>
        )}
        <button
          type="button"
          className={styles.action}
          aria-label={applyLabel}
          title={applyLabel}
          // Ohne gültige Adresse gibt es nichts zu übernehmen.
          disabled={!href}
          onMouseDown={(e) => e.preventDefault()}
          onClick={submit}
        >
          <Icon icon="lucide:check" width={15} />
        </button>
      </div>

      {withName && (
        <div className={styles.row}>
          <Icon icon="lucide:type" width={15} className={styles.icon} />
          <input
            type="text"
            className={styles.input}
            aria-label={nameLabel}
            placeholder={namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
      )}
    </div>
  );
}
