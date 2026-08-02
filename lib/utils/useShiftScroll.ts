"use client";

import { useEffect, useState } from "react";

/**
 * Firefox meldet Mausrad-Rasten in Zeilen statt in Pixeln — ohne Umrechnung
 * käme dort pro Raste ein Ruck von drei Pixeln heraus.
 */
const LINE = 16;

/** Das Rad-Delta in Pixeln, in welcher Einheit der Browser es auch liefert. */
function pixels(e: WheelEvent, page: number) {
  // Mit gedrückter Shift-Taste legen manche Browser die Bewegung von sich aus
  // auf die X-Achse. Es zählt deshalb die Achse, die den Ausschlag trägt.
  const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) return delta * LINE;
  if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) return delta * page;
  return delta;
}

/**
 * Shift + Mausrad schiebt den Container waagerecht — über seiner ganzen Fläche,
 * auch dort, wo ein Kind unter dem Zeiger selbst senkrecht scrollt.
 *
 * Ohne das übernimmt beim Board die Spalte unter dem Zeiger die Bewegung: sie
 * ist der nächste Scroll-Container, und ob der Browser Shift + Rad überhaupt
 * auf die Waagerechte umlegt, ist von Browser zu Browser verschieden. Die Geste
 * funktionierte dann nur in den Lücken zwischen den Spalten — also fast
 * nirgends.
 *
 * ```tsx
 * const ref = useShiftScroll()
 * return <div ref={ref} className={styles.board}>…</div>
 * ```
 *
 * Der Listener hängt von Hand am Element statt als `onWheel`-Prop: React meldet
 * Rad-Ereignisse passiv an, und passiv heißt, `preventDefault` bleibt wirkungslos.
 */
export function useShiftScroll() {
  // Das Element als Zustand, nicht als Ref: nur so erfährt der Effekt davon und
  // hängt seinen Listener an.
  const [element, setElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!element) return;

    const onWheel = (e: WheelEvent) => {
      // Strg + Rad ist der Zoom des Browsers, die übrigen Kombinationen gehören
      // dem System — nur Shift allein ist die Geste.
      if (!e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
      // Steht alles nebeneinander, gibt es nichts zu schieben; dann behält der
      // Browser seine gewohnte Reaktion.
      if (element.scrollWidth <= element.clientWidth) return;

      const delta = pixels(e, element.clientWidth);
      if (delta === 0) return;

      e.preventDefault();
      // Am Rand angekommen bleibt die Bewegung liegen, statt weiterzureichen:
      // ein Board, das sich nicht weiter schieben lässt, soll auch nicht
      // plötzlich eine Spalte senkrecht bewegen.
      element.scrollLeft += delta;
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [element]);

  return setElement;
}
