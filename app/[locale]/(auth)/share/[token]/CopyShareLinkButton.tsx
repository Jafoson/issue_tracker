"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";

interface Props {
  copyLabel: string;
  copiedLabel: string;
}

/** Copies the current page URL — the same address already shown in the
 *  address bar, no server-built link needed. */
export function CopyShareLinkButton({ copyLabel, copiedLabel }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Without clipboard permission, it stays at the attempt.
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
