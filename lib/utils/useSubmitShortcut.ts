"use client";

import { useEffect, useRef } from "react";

/**
 * Fires `onSubmit` on ⌘/Ctrl + Enter — the submit gesture used by every
 * composer modal.
 *
 * The callback lives in a ref that's updated after every render. This way
 * the listener stays registered for the whole lifetime and still always
 * sees the current form state — without reattaching the handler on every
 * keystroke.
 */
export function useSubmitShortcut(onSubmit: () => void, enabled = true) {
  const handler = useRef(onSubmit);

  useEffect(() => {
    handler.current = onSubmit;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handler.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled]);
}
