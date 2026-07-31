"use client";

import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";

/**
 * Ein `Button`, der Text in die Zwischenablage legt und es kurz bestätigt.
 *
 * Kein eigenes Aussehen — das kommt vollständig vom `Button`. Diese Hülle
 * trägt nur das Verhalten: den Zugriff auf die Zwischenablage und die
 * Bestätigung danach. Deshalb steht sie hier und nicht unter `atoms/`: die
 * sind unteilbar, das hier ist eine Zusammensetzung.
 *
 * Eine eigene Komponente bleibt sie trotzdem, weil sie auch im Codeblock der
 * **Anzeige** steht — und die rendert serverseitig. So ist genau dieser Knopf
 * die einzige Stelle darin, die den Browser braucht.
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
    <Button
      variant="ghost"
      size="sm"
      className={className}
      icon={<Icon icon={copied ? "lucide:check" : "lucide:copy"} width={14} />}
      aria-label={copied ? copiedLabel : label}
      title={copied ? copiedLabel : label}
      // Im Editor darf der Fokus den Text nicht verlassen.
      onMouseDown={(e) => e.preventDefault()}
      onClick={copy}
    />
  );
}
