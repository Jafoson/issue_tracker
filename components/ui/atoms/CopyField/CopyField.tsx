"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";
import styles from "./copyField.module.scss";

interface CopyFieldProps {
  /** Der Wert, der kopiert wird — und der zu lesen sein muss. */
  value: string;
  /** Beschriftung des Knopfes, lokalisiert. */
  copyLabel: string;
  /** Bestätigung nach dem Kopieren, lokalisiert. */
  copiedLabel: string;
}

/**
 * Ein Wert zum Mitnehmen: sichtbar, auswählbar, mit einem Knopf zum Kopieren.
 *
 * Kein Eingabefeld — es gibt hier nichts einzugeben. Der Text bleibt trotzdem
 * markierbar, damit auch von Hand kopieren geht, wenn die Clipboard-API fehlt
 * (unsicherer Kontext, verweigerte Berechtigung).
 */
export function CopyField({ value, copyLabel, copiedLabel }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Kein Zugriff auf die Zwischenablage — der Wert steht daneben und lässt
      // sich markieren. Eine Fehlermeldung hülfe hier nicht weiter.
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
