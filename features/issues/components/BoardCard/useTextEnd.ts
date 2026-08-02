"use client";

import { useLayoutEffect, useState } from "react";

/** Ende der letzten sichtbaren Zeile, in Pixeln vom Kasten des Textes aus. */
export interface TextEnd {
  x: number;
  y: number;
}

/**
 * Misst, wo ein umbrechender Text aufhört — die Stelle, an der etwas anschließen
 * kann, das zu ihm gehört (hier: der Stift am Titel).
 *
 * CSS kennt diesen Punkt nicht. Ein Nachbar richtet sich am *Kasten* des Textes
 * aus, steht also bei einer kurzen Schlusszeile weit hinter ihr; setzt man ihn
 * dagegen in den Textfluss, schneidet ihn die Zeilenbegrenzung
 * (`-webkit-line-clamp`) bei langen Titeln mit ab. Bleibt das Messen — die
 * einzige Ausnahme von "Aussehen gehört ins Stylesheet": das Ergebnis sind zwei
 * Zahlen, gesetzt wird damit weiterhin in CSS.
 *
 * Die von der Begrenzung abgeschnittenen Zeilen zählen nicht mit: sie liegen
 * unterhalb des Kastens. Gemessen wird also das Ende der letzten Zeile, die man
 * wirklich sieht — bei einem gekürzten Titel das der Zeile mit dem "…".
 *
 * ```tsx
 * const { ref, end } = useTextEnd(title)
 * <p ref={ref}>{title}</p>
 * ```
 */
export function useTextEnd(
  /** Ändert sich der Text, stimmt die alte Messung nicht mehr. */
  text: string,
) {
  // Das Element als Zustand, nicht als Ref: nur so merkt der Effekt, wenn ein
  // neuer Absatz gerendert wurde (nach dem Bearbeiten), und hängt seinen
  // Beobachter an den neuen statt an den weggeworfenen.
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [end, setEnd] = useState<TextEnd | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `text` wird im Effekt nicht gelesen, entscheidet aber über den Umbruch — ändert er sich, muss neu gemessen werden
  useLayoutEffect(() => {
    if (!element) return;

    const measure = () => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const box = element.getBoundingClientRect();
      // Ein Rechteck je Zeile — das letzte, das noch im Kasten liegt, ist die
      // letzte sichtbare Zeile.
      const lines = Array.from(range.getClientRects()).filter(
        (line) => line.bottom <= box.bottom + 1,
      );
      const last = lines[lines.length - 1];
      // Ohne Text (oder ohne Zeile) gibt es kein Ende — dann greift die Vorgabe
      // im Stylesheet.
      setEnd(
        last ? { x: last.right - box.left, y: last.bottom - box.top } : null,
      );
    };

    measure();
    // Wird die Spalte schmaler, bricht der Titel anders um.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, text]);

  return { ref: setElement, end };
}
