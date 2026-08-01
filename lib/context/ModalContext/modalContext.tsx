"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import styles from "./modalContext.module.scss";

export interface ModalRenderProps {
  close: () => void;
  /**
   * Ändert die Optionen dieses Modals im laufenden Betrieb — Platzierung und
   * Breite.
   *
   * Gedacht für Inhalte, die zwischen zwei Darstellungen wechseln können, ohne
   * neu geöffnet zu werden. Die Issue-Ansicht macht das nicht mehr über diesen
   * Weg: sie hängt im Dock (`DockContext`) und hebt sich dort selbst an.
   */
  setOptions: (patch: Partial<ModalOptions>) => void;
}

/**
 * Wo das Modal sitzt: `center` als Dialog über der Seite, `right` als
 * Seitenpanel, das an der rechten Kante klebt und über die volle Höhe geht.
 */
export type ModalPlacement = "center" | "right";

export interface ModalOptions {
  /** Panel-Breite, z.B. 600 oder "80vw". Default: Basisbreite des Inhalts. */
  width?: number | string;
  /** Schließen per Backdrop-Klick / Escape erlauben. Default: true. */
  dismissible?: boolean;
  /** Default: "center". */
  placement?: ModalPlacement;
  /**
   * Hebt den Versatz von oben auf — das Modal steht dann genau in der Mitte.
   *
   * Nur bei `placement: "center"` von Belang. Kleine Dialoge wirken mittig zu
   * tief und sitzen deshalb standardmäßig etwas höher; große nutzen die Höhe
   * besser aus, wenn der Versatz wegfällt.
   */
  centered?: boolean;
  /**
   * Barrierefreier Name des Dialogs. Ohne ihn kündigt der Screenreader nur
   * „Dialog“ an — bitte lokalisiert übergeben.
   */
  label?: string;
  /**
   * Läuft, sobald das Modal geschlossen wird — egal ob per Escape, Backdrop
   * oder `close()`. Gedacht für Öffner, die neben dem Modal einen eigenen
   * Zustand führen (z.B. einen URL-Parameter), der mitverschwinden muss.
   * `closeModal(id, { silent: true })` überspringt den Aufruf.
   */
  onClose?: () => void;
}

/** Aufräumen ohne Rückmeldung an den Öffner — siehe `ModalOptions.onClose`. */
interface CloseOptions {
  silent?: boolean;
}

type ModalContent =
  | React.ReactNode
  | ((props: ModalRenderProps) => React.ReactNode);

interface ModalEntry {
  id: string;
  content: ModalContent;
  options: ModalOptions;
  trigger: Element | null;
}

interface ModalValue {
  /** Rendert `content` als Modal. `content` kann eine Render-Function sein, die `close` erhält. */
  openModal: (content: ModalContent, options?: ModalOptions) => string;
  /** Schließt das Modal mit `id`, ohne `id` das oberste. */
  closeModal: (id?: string, options?: CloseOptions) => void;
  closeAllModals: () => void;
  /** Schreibt die Optionen eines offenen Modals fort — siehe `ModalRenderProps.setOptions`. */
  setModalOptions: (id: string, patch: Partial<ModalOptions>) => void;
}

const Ctx = createContext<ModalValue | null>(null);
const StackCtx = createContext<ModalEntry[] | null>(null);

export function useModal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useModal must be used within ModalProvider");
  return ctx;
}

/**
 * Ob gerade ein Modal offen ist.
 *
 * Für alles, was ebenfalls auf Escape hört und dabei zurücktreten muss: ein
 * Modal liegt immer oben, also gehört die Taste ihm. Das Dock-Panel nutzt das
 * — sonst schlösse Escape das Panel unter dem Dialog statt des Dialogs.
 */
export function useHasOpenModal() {
  return (useContext(StackCtx)?.length ?? 0) > 0;
}

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<ModalEntry[]>([]);
  // Spiegel des Stacks: `onClose`-Handler dürfen synchron weiterschließen, und
  // dafür muss der aktuelle Stand schon vor dem nächsten Render feststehen.
  const stackRef = useRef<ModalEntry[]>(stack);
  const counter = useRef(0);

  const commit = useCallback((next: ModalEntry[]) => {
    stackRef.current = next;
    setStack(next);
  }, []);

  const closeModal = useCallback(
    (id?: string, options?: CloseOptions) => {
      const current = stackRef.current;
      const entry = id ? current.find((m) => m.id === id) : current.at(-1);
      if (!entry) return;
      // Erst den Stack fortschreiben, dann melden: ein `onClose`, das seinerseits
      // schließt (URL-Sync), findet den Eintrag dann nicht mehr vor.
      commit(current.filter((m) => m.id !== entry.id));
      if (!options?.silent) entry.options.onClose?.();
    },
    [commit],
  );

  const closeAllModals = useCallback(() => {
    const current = stackRef.current;
    commit([]);
    for (const entry of current) entry.options.onClose?.();
  }, [commit]);

  const setModalOptions = useCallback(
    (id: string, patch: Partial<ModalOptions>) => {
      commit(
        stackRef.current.map((entry) =>
          entry.id === id
            ? { ...entry, options: { ...entry.options, ...patch } }
            : entry,
        ),
      );
    },
    [commit],
  );

  const openModal = useCallback(
    (content: ModalContent, options: ModalOptions = {}) => {
      const id = `modal-${++counter.current}`;
      commit([
        ...stackRef.current,
        { id, content, options, trigger: document.activeElement },
      ]);
      return id;
    },
    [commit],
  );

  // Escape schließt nur das oberste (nicht explizit undismissible) Modal im Stack.
  useEffect(() => {
    if (stack.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const top = stack[stack.length - 1];
      if (top.options.dismissible === false) return;
      e.stopPropagation();
      closeModal(top.id);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [stack, closeModal]);

  return (
    <Ctx.Provider
      value={{ openModal, closeModal, closeAllModals, setModalOptions }}
    >
      <StackCtx.Provider value={stack}>{children}</StackCtx.Provider>
    </Ctx.Provider>
  );
}

/**
 * Rendert den Modal-Stack. Muss genau einmal unterhalb des `ModalProvider`
 * platziert werden — und zwar an der Stelle im React-Baum, deren Contexts die
 * Modal-Inhalte sehen sollen (z.B. unterhalb des `NextIntlClientProvider`).
 *
 * Grund: `createPortal` verschiebt nur den DOM-Knoten nach `document.body`, die
 * Context-Auflösung folgt weiter dem React-Baum. Würde der Provider den Stack
 * selbst rendern, hingen die Inhalte an seiner Position — oberhalb aller
 * Provider, die erst in tieferen Layouts gesetzt werden.
 */
export function ModalOutlet() {
  const stack = useContext(StackCtx);
  const { closeModal, setModalOptions } = useModal();

  // Auch der SSR-Guard für createPortal: serverseitig ist der Stack immer leer.
  if (!stack || stack.length === 0) return null;

  return createPortal(
    stack.map((modal, index) => (
      <ModalFrame
        key={modal.id}
        modal={modal}
        index={index}
        onClose={() => closeModal(modal.id)}
        onSetOptions={(patch) => setModalOptions(modal.id, patch)}
      />
    )),
    document.body,
  );
}

function ModalFrame({
  modal,
  index,
  onClose,
  onSetOptions,
}: {
  modal: ModalEntry;
  index: number;
  onClose: () => void;
  onSetOptions: (patch: Partial<ModalOptions>) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dismissible = modal.options.dismissible !== false;
  const placement = modal.options.placement ?? "center";
  const centered = modal.options.centered === true;
  const cx = (...names: (string | false)[]) => names.filter(Boolean).join(" ");

  useEffect(() => {
    // Nur einspringen, wenn der Inhalt nicht selbst schon fokussiert hat (z.B.
    // per `autoFocus` auf dem Titelfeld) — sonst würde der Panel-Fokus die
    // Eingabe direkt wieder wegnehmen.
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus();

    const trigger = modal.trigger;
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, [modal.trigger]);

  return (
    <div
      className={cx(
        styles.overlay,
        placement === "right" && styles.right,
        centered && styles.centered,
      )}
      style={{ zIndex: `calc(var(--z-overlay) + ${index})` }}
    >
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Close"
        onClick={() => dismissible && onClose()}
      />
      <div
        ref={panelRef}
        className={cx(styles.comp, placement === "right" && styles.right)}
        role="dialog"
        aria-modal="true"
        aria-label={modal.options.label}
        tabIndex={-1}
        style={modal.options.width ? { width: modal.options.width } : undefined}
      >
        {typeof modal.content === "function"
          ? modal.content({ close: onClose, setOptions: onSetOptions })
          : modal.content}
      </div>
    </div>
  );
}
