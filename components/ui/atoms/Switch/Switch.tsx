"use client";

import styles from "./switch.module.scss";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /**
   * Was der Schalter schaltet — sichtbar daneben oder, in einer Tabelle mit
   * Spaltenköpfen, nur für Screenreader (`labelHidden`).
   */
  label: string;
  labelHidden?: boolean;
  disabled?: boolean;
  id?: string;
}

/**
 * Ein zweiwertiger Schalter: an oder aus, sofort wirksam.
 *
 * Er trägt bewusst kein „Speichern" — ein Schalter, dessen Stellung erst nach
 * einem Knopfdruck gilt, zeigt zwischendurch etwas an, das nicht stimmt. Wer ihn
 * setzt, schreibt in derselben Bewegung.
 *
 * Innen liegt eine echte Checkbox: Tastatur, Fokus und Screenreader kommen von
 * ihr, sichtbar ist nur die Bahn mit dem Knauf darauf. `role="switch"` sagt
 * dabei „an/aus" statt „ausgewählt/nicht ausgewählt" — dasselbe Element, die
 * passendere Ansage.
 */
export function Switch({
  checked,
  onChange,
  label,
  labelHidden = false,
  disabled = false,
  id,
}: SwitchProps) {
  return (
    <label className={styles.root} data-disabled={disabled || undefined}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        // Doppelt gemoppelt: die Checkbox trägt ihren Zustand schon selbst.
        // `role="switch"` erwartet ihn laut ARIA trotzdem ausdrücklich, und
        // widersprechen können sich beide nicht — sie kommen aus derselben Prop.
        aria-checked={checked}
        className={styles.input}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.track} aria-hidden>
        <span className={styles.knob} />
      </span>
      <span className={labelHidden ? styles.hiddenLabel : styles.label}>
        {label}
      </span>
    </label>
  );
}
