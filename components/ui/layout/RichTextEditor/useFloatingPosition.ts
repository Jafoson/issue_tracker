"use client";

import {
  computePosition,
  flip,
  offset,
  type ReferenceElement,
  shift,
} from "@floating-ui/dom";
import { useLayoutEffect, useRef, useState } from "react";

/**
 * Positioniert eine frei schwebende Einblendung (Adresszeile, Anhang-Dialog)
 * an einem Bezugspunkt — dem angeklickten Werkzeugleisten-Knopf oder, ohne
 * Klick, einem virtuellen Element am Cursor — und weicht bei Platzmangel am
 * Fensterrand aus, statt darüber hinauszulaufen.
 *
 * Dasselbe Prinzip wie `props.mount` aus `@tiptap/suggestion` fürs `/`-Menü
 * (auch das läuft über Floating UI), nur für Einblendungen außerhalb des
 * Suggestion-Plugins, die keine Textposition im Dokument haben.
 */
export function useFloatingPosition(
  reference: ReferenceElement | null,
  // Löst eine Neuberechnung aus, auch wenn `reference` dasselbe Objekt
  // bleibt — z. B. wenn der Anhang-Dialog von der Auswahl auf das
  // URL-Formular wechselt: andere Größe, aber derselbe Bezugspunkt.
  recomputeKey?: unknown,
) {
  const floatingRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{
    left: number;
    top: number;
    visibility: "visible" | "hidden";
  }>({ left: 0, top: 0, visibility: "hidden" });

  // Ohne die Sichtbarkeit erst nach der Messung freizugeben, blitzt die
  // Einblendung kurz oben links auf, bevor sie an ihren Platz springt.
  useLayoutEffect(() => {
    // Erzwingt die Neuberechnung unten, auch wenn `reference` dasselbe
    // Objekt bleibt (siehe Kommentar am Parameter).
    void recomputeKey;
    const floating = floatingRef.current;
    if (!reference || !floating) {
      setStyle((s) =>
        s.visibility === "hidden" ? s : { ...s, visibility: "hidden" },
      );
      return;
    }
    let cancelled = false;
    computePosition(reference, floating, {
      // `fixed`, nicht das Standard-`absolute` — `.floatingLayer` hängt selbst
      // per `position: fixed` am Body, damit ein scrollender Editor sie nicht
      // mitschneidet.
      strategy: "fixed",
      placement: "bottom-start",
      middleware: [offset(6), flip(), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      if (!cancelled) setStyle({ left: x, top: y, visibility: "visible" });
    });
    return () => {
      cancelled = true;
    };
  }, [reference, recomputeKey]);

  return { floatingRef, style };
}
