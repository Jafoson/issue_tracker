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
  /**
   * Hebt das Panel von der Kante in die Mitte, als Overlay über der ganzen
   * Seite. Der ausgeklappte Zustand der Detailansicht — dort ist die Breite
   * wichtiger als der Blick auf die Liste daneben.
   */
  isOverlay: boolean;
  setOverlay: (overlay: boolean) => void;
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
  const [isOverlay, setOverlay] = useState(false);

  return (
    <Ctx.Provider value={{ node, isOverlay, setOverlay }}>
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
  const { isOverlay } = useDock();

  return (
    <div
      ref={setNode ?? undefined}
      className={[styles.dock, isOverlay && styles.overlay]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

interface DockPanelProps {
  /** Barrierefreier Name des Bereichs — bitte lokalisiert übergeben. */
  label: string;
  /** Escape schließt; ein Klick daneben nicht. */
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Die Hülle eines Panels im Dock. Kein `role="dialog"`, kein `aria-modal`:
 * das hier sperrt nichts aus, es steht daneben. Deshalb nur ein benannter
 * Bereich, den man verlassen kann, ohne ihn zu schließen.
 *
 * Beim Öffnen wandert der Fokus hinein und beim Schließen dorthin zurück, wo
 * er herkam — sonst stünde man nach dem Schließen am Anfang der Seite.
 */
export function DockPanel({ label, onClose, children }: DockPanelProps) {
  const ref = useRef<HTMLElement>(null);
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

  return (
    // `tabindex="-1"` macht den Bereich nicht bedienbar, sondern nur
    // programmatisch fokussierbar — der Fokus muss beim Öffnen irgendwo landen.
    <section
      ref={ref}
      className={styles.panel}
      aria-label={label}
      tabIndex={-1}
    >
      {children}
    </section>
  );
}
