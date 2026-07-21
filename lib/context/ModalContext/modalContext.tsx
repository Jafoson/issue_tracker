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
}

export interface ModalOptions {
  /** Panel-Breite, z.B. 600 oder "80vw". Default: Basisbreite von `.orbit-comp`. */
  width?: number | string;
  /** Schließen per Backdrop-Klick / Escape erlauben. Default: true. */
  dismissible?: boolean;
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
  closeModal: (id?: string) => void;
  closeAllModals: () => void;
}

const Ctx = createContext<ModalValue | null>(null);

export function useModal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useModal must be used within ModalProvider");
  return ctx;
}

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<ModalEntry[]>([]);
  const counter = useRef(0);

  const closeModal = useCallback((id?: string) => {
    setStack((s) => (id ? s.filter((m) => m.id !== id) : s.slice(0, -1)));
  }, []);

  const closeAllModals = useCallback(() => setStack([]), []);

  const openModal = useCallback(
    (content: ModalContent, options: ModalOptions = {}) => {
      const id = `modal-${++counter.current}`;
      setStack((s) => [
        ...s,
        { id, content, options, trigger: document.activeElement },
      ]);
      return id;
    },
    [],
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
    <Ctx.Provider value={{ openModal, closeModal, closeAllModals }}>
      {children}
      {stack.length > 0 &&
        createPortal(
          stack.map((modal, index) => (
            <ModalFrame
              key={modal.id}
              modal={modal}
              index={index}
              onClose={() => closeModal(modal.id)}
            />
          )),
          document.body,
        )}
    </Ctx.Provider>
  );
}

function ModalFrame({
  modal,
  index,
  onClose,
}: {
  modal: ModalEntry;
  index: number;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dismissible = modal.options.dismissible !== false;

  useEffect(() => {
    panelRef.current?.focus();
    const trigger = modal.trigger;
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, [modal.trigger]);

  return (
    <div
      className={styles.overlay}
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
        className={styles.comp}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        style={modal.options.width ? { width: modal.options.width } : undefined}
      >
        {typeof modal.content === "function"
          ? modal.content({ close: onClose })
          : modal.content}
      </div>
    </div>
  );
}
