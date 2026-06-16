"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import styles from "./input.module.scss";

type InputVariant = "text" | "password" | "search" | "date";
type InputSize = "sm" | "md";

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  variant?: InputVariant;
  label?: string;
  hint?: string;
  error?: string;
  size?: InputSize;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  ref?: React.Ref<HTMLInputElement>;
}

export function Input({
  variant = "text",
  label,
  hint,
  error,
  size = "md",
  id,
  className,
  iconLeft,
  iconRight,
  ref,
  ...rest
}: InputProps) {
  const [showPw, setShowPw] = useState(false);

  const inputId = id ?? (label ? `input-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);

  // Search gets default search icon unless caller overrides with iconLeft
  const leftNode  = iconLeft ?? (variant === "search" ? <Icon icon="lucide:search" width={15} /> : null);
  const hasLeft   = !!leftNode;
  const hasRight  = variant === "password" || !!iconRight;

  const inputType = variant === "password"
    ? (showPw ? "text" : "password")
    : variant === "search" ? "text" : variant;

  return (
    <div className={[styles.wrap, size === "sm" && styles.sm].filter(Boolean).join(" ")}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      )}

      <div className={styles.inputWrap}>
        {hasLeft && (
          <span className={styles.iconLeft}>{leftNode}</span>
        )}

        <input
          ref={ref}
          id={inputId}
          type={inputType}
          className={[
            styles.input,
            error    && styles.hasError,
            hasLeft  && styles.hasIconLeft,
            hasRight && styles.hasIconRight,
            className,
          ].filter(Boolean).join(" ")}
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
              <Icon icon={showPw ? "lucide:eye-off" : "lucide:eye"} width={15} />
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
