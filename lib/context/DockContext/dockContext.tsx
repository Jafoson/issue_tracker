"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useHasOpenModal } from "../ModalContext/modalContext";
import styles from "./dockContext.module.scss";

/**
 * Das Dock ist der Platz für ein Panel, das **neben** der Seite steht statt
 * über ihr: die Issue-Detailansicht an der rechten Kante.
 *
 * Der Unterschied zum Modal ist keiner der Optik, sondern des Layouts. Das
 * Modal liegt in einem Portal auf `document.body` und deckt zu, was darunter
 * liegt. Das Dock ist ein echtes Element der App-Hülle — die Seite daneben
 * bekommt entsprechend weniger Breite und ordnet sich neu. Deshalb gibt es
 * hier auch keinen Backdrop: es gibt kein „außerhalb", auf das man klicken
 * könnte, und ein Klick in die Seite bleibt ein Klick in die Seite.
 *
 * Damit ein Panel, das tief in einer Seite entsteht (`IssuePeek` hängt am
 * URL-Parameter), oben in der Hülle landet, reicht das Dock nur den Knoten
 * heraus. Portiert wird von der aufrufenden Seite aus — so folgen die Contexts
 * weiter dem React-Baum, in dem das Panel gedanklich steht.
 */
interface DockValue {
  /** Ziel für `createPortal`. Bis der Outlet montiert ist: `null`. */
  node: HTMLElement | null;
}

const Ctx = createContext<DockValue | null>(null);

/** Nur der Outlet meldet den Knoten an — kein Grund, ihn breiter zu streuen. */
const SetNodeCtx = createContext<((node: HTMLElement | null) => void) | null>(
  null,
);

export function useDock() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDock must be used within DockProvider");
  return ctx;
}

export function DockProvider({ children }: { children: React.ReactNode }) {
  const [node, setNode] = useState<HTMLElement | null>(null);

  return (
    <Ctx.Provider value={{ node }}>
      <SetNodeCtx.Provider value={setNode}>{children}</SetNodeCtx.Provider>
    </Ctx.Provider>
  );
}

/**
 * Der Platz des Docks in der App-Hülle. Gehört als Geschwister neben den
 * Inhaltsbereich, damit dieser schmaler wird, sobald ein Panel darin steht.
 * Solange keines da ist, ist das Element leer und nimmt keine Breite ein.
 */
export function DockOutlet() {
  const setNode = useContext(SetNodeCtx);
  return <div ref={setNode ?? undefined} className={styles.dock} />;
}

interface DockPanelProps {
  /** Barrierefreier Name des Bereichs — bitte lokalisiert übergeben. */
  label: string;
  /**
   * Hebt das Panel von der Kante in die Mitte, über die ganze Seite. Es ist
   * dann `position: fixed` und beansprucht im Dock keinen Platz mehr — der
   * Inhalt daneben bekommt seine Breite zurück, ohne dass jemand sie ihm
   * zurückgeben müsste.
   */
  overlay?: boolean;
  /** Beschriftung des Backdrops. Nur im Overlay-Zustand von Belang. */
  closeLabel?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Die Hülle eines Panels im Dock — in zwei Ausprägungen, je nachdem, wo es
 * steht.
 *
 * An der Kante ist es kein Dialog: es sperrt nichts aus, deshalb nur ein
 * benannter Bereich (`role="region"`), den man verlassen kann, ohne ihn zu
 * schließen. Ein Klick in die Seite daneben ist ein Klick in die Seite.
 *
 * In der Mitte ist es einer, und dann gelten dessen Regeln vollständig:
 * `role="dialog"` mit `aria-modal`, ein Backdrop, der zudeckt, und ein Klick
 * darauf schließt. Wer ausklappt, erwartet ein Modal — und ein Modal, das man
 * nicht wegklicken kann, fühlt sich kaputt an.
 *
 * In beiden Fällen wandert der Fokus beim Öffnen hinein und beim Schließen
 * dorthin zurück, wo er herkam — sonst stünde man nach dem Schließen am Anfang
 * der Seite. Und Escape schließt.
 */
export function DockPanel({
  label,
  overlay = false,
  closeLabel,
  onClose,
  children,
}: DockPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const hasOpenModal = useHasOpenModal();

  useEffect(() => {
    const panel = ref.current;
    // Vor dem Fokuswechsel merken, wohin er zurück soll.
    const trigger = document.activeElement;
    if (panel && !panel.contains(document.activeElement)) panel.focus();
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, []);

  /**
   * Escape schließt das Panel — aber nur, wenn es das Oberste ist. Liegt ein
   * Modal darüber, gehört die Taste ihm. Auf `document` mit Capture, damit
   * Felder und Menüs im Panel sie vorher am `window` abfangen können (so
   * verwirft Escape erst die laufende Eingabe, nicht gleich das Ganze).
   */
  useEffect(() => {
    if (hasOpenModal) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [hasOpenModal, onClose]);

  /**
   * Was der Bereich für die Vorlesesoftware ist, hängt am Zustand. Rolle und
   * Name stehen zusammen in einem Objekt, weil sie nur gemeinsam gelten:
   * `aria-modal` gehört zur Dialogrolle, und ein `region` ohne Namen wäre
   * gar keine.
   */
  const semantics = overlay
    ? ({ role: "dialog", "aria-modal": true, "aria-label": label } as const)
    : ({ role: "region", "aria-label": label } as const);

  // Die Hülle steht in beiden Zuständen, nur ihre Rolle im Layout wechselt.
  // Ohne sie wanderte das Panel beim Ausklappen an eine andere Stelle im Baum
  // — React baute es dann neu auf, und die Ansicht lüde von vorn.
  return (
    <div className={overlay ? styles.overlay : styles.layer}>
      {/* Der Backdrop ist ein Knopf und keine Fläche mit `onClick`: so ist das
          Schließen auch ohne Maus erreichbar, und es ist derselbe Aufbau wie
          im Modal-Stack (`ModalFrame`). */}
      {overlay && (
        <button
          type="button"
          className={styles.backdrop}
          aria-label={closeLabel}
          onClick={onClose}
        />
      )}
      {/* `tabindex="-1"` macht den Bereich nicht bedienbar, sondern nur
          programmatisch fokussierbar — der Fokus muss beim Öffnen irgendwo
          landen. */}
      <div ref={ref} className={styles.panel} tabIndex={-1} {...semantics}>
        {children}
      </div>
    </div>
  );
}
