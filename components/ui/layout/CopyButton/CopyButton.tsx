"use client";

import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import styles from "./copyButton.module.scss";

/**
 * A `Button` that copies text to the clipboard and briefly confirms it.
 *
 * Appearance and size come from `Button`; this wrapper carries the
 * behavior — clipboard access and the confirmation afterward. That's why it
 * lives here and not under `atoms/`: those are indivisible, this is a
 * composition.
 *
 * The confirmation shows on the button itself rather than via a toast: the
 * message belongs where the click happened. (A toast store does exist in
 * `lib/ui-store.tsx`, but it isn't mounted in any layout and renders
 * nothing.)
 *
 * It stays its own component regardless, because it also appears in the code
 * block of the **display** path — which renders server-side. So this button
 * is the one and only spot in there that needs the browser.
 */

interface CopyButtonProps {
  value: string;
  label: string;
  /** Shown for as long as the confirmation is visible. */
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

  // The confirmation disappears on its own. The timer is tied to state so
  // it gets cleaned up when the page is left.
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
      // No clipboard without permission or over an insecure connection.
      // Nothing happens then — an error message would make more noise than
      // the situation is worth.
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={[styles.copy, className].filter(Boolean).join(" ")}
      data-copied={copied || undefined}
      icon={<Icon icon={copied ? "lucide:check" : "lucide:copy"} width={14} />}
      aria-label={copied ? copiedLabel : label}
      title={copied ? copiedLabel : label}
      // The text only appears for the moment of confirmation — otherwise a
      // word would sit there permanently where an icon is enough.
      onMouseDown={(e) => e.preventDefault()}
      onClick={copy}
    >
      {copied ? copiedLabel : null}
    </Button>
  );
}
