"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";
import styles from "./copyField.module.scss";

interface CopyFieldProps {
  /** The value being copied — and that must be readable. */
  value: string;
  /** Label for the button, localized. */
  copyLabel: string;
  /** Confirmation after copying, localized. */
  copiedLabel: string;
}

/**
 * A value to take with you: visible, selectable, with a button to copy it.
 *
 * Not an input field — there's nothing to type here. The text still stays
 * selectable so copying by hand also works when the Clipboard API is
 * unavailable (insecure context, denied permission).
 */
export function CopyField({ value, copyLabel, copiedLabel }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // No access to the clipboard — the value is right there and can be
      // selected. An error message wouldn't help here.
    }
  };

  return (
    <div className={styles.root}>
      <code className={styles.value}>{value}</code>
      <button
        type="button"
        className={styles.button}
        onClick={copy}
        aria-label={copied ? copiedLabel : copyLabel}
      >
        <Icon icon={copied ? "lucide:check" : "lucide:copy"} width={14} />
        {copied ? copiedLabel : copyLabel}
      </button>
    </div>
  );
}
