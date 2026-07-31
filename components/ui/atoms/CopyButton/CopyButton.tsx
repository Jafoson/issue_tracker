"use client";

import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import styles from "./copyButton.module.scss";

/**
 * Kopiert einen Text in die Zwischenablage und bestätigt es kurz.
 *
 * Bewusst klein und eigenständig: der Codeblock, in dem er sitzt, wird
 * serverseitig gerendert. Nur dieser Knopf braucht den Browser — so bleibt der
 * Rest davon frei.
 */

interface CopyButtonProps {
  value: string;
  label: string;
  /** Steht da, solange die Bestätigung sichtbar ist. */
  copiedLabel: string;
  className?: string;
}

export function CopyButton({
  value,
  label,
  copiedLabel,
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  // Die Bestätigung verschwindet von selbst. Der Timer hängt am Zustand, damit
  // er beim Verlassen der Seite mit aufgeräumt wird.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Ohne Berechtigung oder über eine unsichere Verbindung gibt es keine
      // Zwischenablage. Dann passiert eben nichts — eine Fehlermeldung wäre
      // hier lauter als die Sache wert ist.
    }
  };

  return (
    <button
      type="button"
      className={[styles.copy, className].filter(Boolean).join(" ")}
      data-copied={copied || undefined}
      aria-label={copied ? copiedLabel : label}
      title={copied ? copiedLabel : label}
      // Im Editor darf der Fokus den Text nicht verlassen.
      onMouseDown={(e) => e.preventDefault()}
      onClick={copy}
    >
      <Icon icon={copied ? "lucide:check" : "lucide:copy"} width={14} />
    </button>
  );
}
