"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";

interface Props {
  copyLabel: string;
  copiedLabel: string;
}

/** Kopiert die aktuelle Seiten-URL — dieselbe Adresse, die schon in der
 *  Adresszeile steht, kein serverseitig gebauter Link nötig. */
export function CopyShareLinkButton({ copyLabel, copiedLabel }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Ohne Clipboard-Freigabe bleibt es beim Versuch.
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      full
      icon={<Icon icon={copied ? "lucide:check" : "lucide:copy"} width={14} />}
      onClick={copy}
    >
      {copied ? copiedLabel : copyLabel}
    </Button>
  );
}
