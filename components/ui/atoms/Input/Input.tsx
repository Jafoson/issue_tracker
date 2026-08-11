"use client";

import { Icon } from "@iconify/react";
import { useId, useState } from "react";
import styles from "./input.module.scss";

type InputVariant = "text" | "password" | "search" | "date";
type InputSize = "sm" | "md";

/**
 * Wie das Feld aussieht — unabhängig davon, *was* es aufnimmt (`variant`).
 *
 * `boxed` ist der Regelfall: gerahmt, feste Höhe, ein erkennbares Formularfeld.
 *
 * `title` steht am Kopf eines Anlege-Dialogs und sieht aus wie die Überschrift
 * des entstehenden Datensatzes, nicht wie ein Feld: ohne Rahmen, in der Größe
 * der Überschrift, mit einer Fläche erst beim Überfahren. Dieselbe Fläche wie
 * bei Titel und Beschreibung der Detailansicht, damit beide Wege gleich wirken.
 */
type InputAppearance = "boxed" | "title";

interface InputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    // `prefix` gibt es am `<input>` schon — als RDFa-Attribut, das hier
    // niemand meint. Der Vorsatz unten übernimmt den Namen.
    "type" | "size" | "prefix"
  > {
  variant?: InputVariant;
  appearance?: InputAppearance;
  label?: string;
  hint?: string;
  error?: string;
  size?: InputSize;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  /**
   * Ein fester Vorsatz, der zum Wert gehört, aber nicht zur Eingabe — das `@`
   * eines Benutzernamens, das `/` eines Pfades.
   *
   * Anders als `iconLeft`: ein Symbol steht *neben* dem Wert und braucht
   * Abstand, ein Vorsatz steht unmittelbar *davor* und bildet mit dem Getippten
   * ein Wort. Deshalb liegt er nicht als absolut gesetzte Marke im Feld,
   * sondern als erstes Kind im Rahmen — der Rahmen wandert dafür vom `<input>`
   * auf dessen Hülle.
   */
  prefix?: React.ReactNode;
  ref?: React.Ref<HTMLInputElement>;
}

export function Input({
  variant = "text",
  appearance = "boxed",
  label,
  hint,
  error,
  size = "md",
  id,
  className,
  iconLeft,
  iconRight,
  prefix,
  ref,
  ...rest
}: InputProps) {
  const [showPw, setShowPw] = useState(false);
  // Nur für den Vorsatz: sein `htmlFor` braucht ein Ziel, auch wenn das Feld
  // ohne sichtbare Beschriftung auskommt.
  const fallbackId = useId();

  const inputId =
    id ??
    (label ? `input-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined) ??
    (prefix ? fallbackId : undefined);

  // Search gets default search icon unless caller overrides with iconLeft
  const leftNode =
    iconLeft ??
    (variant === "search" ? <Icon icon="lucide:search" width={15} /> : null);
  const hasLeft = !!leftNode;
  const hasRight = variant === "password" || !!iconRight;

  // Mit Vorsatz trägt die Hülle den Rahmen und das `<input>` sitzt nackt darin.
  // Nur so stehen Vorsatz und Wert in derselben Zeile, ohne die Lücke, die eine
  // absolut gesetzte Marke hinterlässt.
  const framed = !!prefix && appearance === "boxed";

  const inputType =
    variant === "password"
      ? showPw
        ? "text"
        : "password"
      : variant === "search"
        ? "text"
        : variant;

  return (
    <div
      className={[styles.wrap, size === "sm" && styles.sm]
        .filter(Boolean)
        .join(" ")}
    >
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      )}

      <div
        className={[styles.inputWrap, framed && styles.framed]
          .filter(Boolean)
          .join(" ")}
      >
        {hasLeft && <span className={styles.iconLeft}>{leftNode}</span>}
        {/* Als `<label>` und nicht als `<span>`: der Vorsatz sieht aus wie ein
            Teil des Feldes, also muss ein Klick darauf auch dorthin führen —
            das kann das Element von sich aus, ohne Handler. `aria-hidden`,
            weil er die Beschriftung nicht ist: `@` ist Schmuck am Wert, und
            vorgelesen würde er den Namen des Feldes verfälschen. */}
        {framed && (
          <label aria-hidden="true" className={styles.prefix} htmlFor={inputId}>
            {prefix}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          type={inputType}
          className={[
            styles.input,
            framed ? styles.bare : styles[appearance],
            error && styles.hasError,
            !framed && hasLeft && styles.hasIconLeft,
            !framed && hasRight && styles.hasIconRight,
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...rest}
        />

        {variant === "password" && (
          <span className={styles.iconRight}>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "Passwort verbergen" : "Passwort anzeigen"}
            >
              <Icon
                icon={showPw ? "lucide:eye-off" : "lucide:eye"}
                width={15}
              />
            </button>
          </span>
        )}

        {variant !== "password" && iconRight && (
          <span className={styles.iconRight}>{iconRight}</span>
        )}
      </div>

      {error && (
        <span className={`${styles.feedback} ${styles.errorText}`}>
          <Icon icon="lucide:circle-alert" width={12} />
          {error}
        </span>
      )}
      {!error && hint && (
        <span className={`${styles.feedback} ${styles.hintText}`}>{hint}</span>
      )}
    </div>
  );
}
