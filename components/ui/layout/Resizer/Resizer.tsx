"use client";

import { useRef, useState } from "react";
import styles from "./resizer.module.scss";

interface ResizerProps {
  /** Aktuelle Breite in px des Elements, das der Griff bemisst. */
  width: number;
  onChange: (width: number) => void;
  min: number;
  max: number;
  /** Zurück auf diesen Wert per Doppelklick. Ohne Angabe passiert nichts. */
  reset?: number;
  /** Schrittweite der Pfeiltasten. Default: 16. */
  step?: number;
  /** Für Screenreader — was hier breiter und schmaler wird. */
  label: string;
  /** Positionierung; die Optik bringt der Griff selbst mit. */
  className?: string;
}

/**
 * Ein Griff zum Ziehen einer Breite.
 *
 * Er sitzt **links** von dem, was er bemisst — nach links ziehen macht breiter.
 * Das passt zu allem, was an der rechten Kante hängt: das Seitenpanel am
 * Bildschirmrand, die Attributspalte an der Panelkante. Für die Gegenrichtung
 * ist er nicht gebaut, das gibt es hier nirgends.
 *
 * Bedienbar ist er auch ohne Maus: fokussierbar, mit Wertebereich, Pfeiltasten
 * schrittweise, Home und End an die Grenzen — das WAI-ARIA-Muster
 * „Window Splitter".
 *
 * Wo er sitzt, entscheidet die Umgebung über `className`. Der Griff bringt nur
 * Trefferfläche, Linie und Verhalten mit, weil das an jeder Kante gleich ist.
 */
export function Resizer({
  width,
  onChange,
  min,
  max,
  reset,
  step = 16,
  label,
  className,
}: ResizerProps) {
  const [isDragging, setIsDragging] = useState(false);
  /** Startpunkt des laufenden Zugs — kein State, es rendert nichts neu. */
  const drag = useRef<{ x: number; width: number } | null>(null);

  const clamp = (value: number) => Math.min(max, Math.max(min, value));

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    // Der Zeiger gehört ab jetzt dem Griff. Ohne das rissen Bewegungen ab,
    // sobald er über den Inhalt daneben wandert.
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, width };
    setIsDragging(true);
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    onChange(clamp(drag.current.width - (event.clientX - drag.current.x)));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null;
    setIsDragging(false);
  };

  const nudge = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") onChange(clamp(width + step));
    else if (event.key === "ArrowRight") onChange(clamp(width - step));
    else if (event.key === "Home") onChange(min);
    else if (event.key === "End") onChange(max);
    else return;
    event.preventDefault();
  };

  return (
    // `data-resizing` liest eine globale Regel: solange gezogen wird, markiert
    // das Dokument nichts und behält den Zeiger des Griffs.
    // biome-ignore lint/a11y/useSemanticElements: `<hr>`, wie die Regel vorschlägt, ist ein thematischer Bruch im Text — hier steht der bedienbare Trenner des WAI-ARIA-Musters „Window Splitter", fokussierbar und mit Wertebereich.
    <div
      className={[styles.resizer, className].filter(Boolean).join(" ")}
      data-resizing={isDragging || undefined}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(width)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={reset === undefined ? undefined : () => onChange(reset)}
      onKeyDown={nudge}
    />
  );
}
