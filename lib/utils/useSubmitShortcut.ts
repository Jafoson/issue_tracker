"use client";

import { useEffect, useRef } from "react";

/**
 * Löst `onSubmit` bei ⌘/Strg + Enter aus — die Abschick-Geste aller
 * Composer-Modals.
 *
 * Der Callback liegt in einer Ref, die nach jedem Render aktualisiert wird.
 * Dadurch bleibt der Listener über die Lebensdauer registriert und sieht
 * trotzdem immer den aktuellen Formularstand — ohne den Handler bei jedem
 * Tastendruck neu anzuhängen.
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
