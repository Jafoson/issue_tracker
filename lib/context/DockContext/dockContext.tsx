"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useHasOpenModal } from "../ModalContext/modalContext";
import styles from "./dockContext.module.scss";

/**
 * The dock is the place for a panel that sits **next to** the page instead
 * of over it: the issue detail view at the right edge.
 *
 * The difference from a modal isn't visual, it's layout. The modal lives in
 * a portal on `document.body` and covers whatever's underneath. The dock is
 * a real element of the app shell — the page next to it shrinks accordingly
 * and reflows. That's also why there's no backdrop here: there's no
 * "outside" to click on, and a click into the page stays a click into the
 * page.
 *
 * So that a panel created deep inside a page (`IssuePeek` hangs off the URL
 * parameter) can land at the top of the shell, the dock only hands out the
 * node. Portalling happens from the calling page — that way the contexts
 * keep following the React tree the panel conceptually belongs to.
 */
interface DockValue {
  /** Target for `createPortal`. `null` until the outlet is mounted. */
  node: HTMLElement | null;
}

const Ctx = createContext<DockValue | null>(null);

/** Only the outlet reports the node — no reason to spread it more widely. */
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
 * The dock's place in the app shell. Sits as a sibling next to the content
 * area, so the latter narrows as soon as a panel is inside it. As long as
 * none is there, the element is empty and takes up no width.
 */
export function DockOutlet() {
  const setNode = useContext(SetNodeCtx);
  return <div ref={setNode ?? undefined} className={styles.dock} />;
}

interface DockPanelProps {
  /** Accessible name of the region — please pass it localized. */
  label: string;
  /**
   * Lifts the panel from the edge into the center, across the whole page.
   * It's then `position: fixed` and no longer takes up space in the dock —
   * the content next to it gets its width back without anyone having to
   * give it back.
   */
  overlay?: boolean;
  /** Label of the backdrop. Only relevant in the overlay state. */
  closeLabel?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * The shell of a panel in the dock — in two forms, depending on where it
 * sits.
 *
 * At the edge it isn't a dialog: it locks nothing out, so it's just a named
 * region (`role="region"`) that can be left without being closed. A click
 * into the page next to it is a click into the page.
 *
 * In the center it is one, and then its rules apply in full: `role="dialog"`
 * with `aria-modal`, a backdrop that covers, and a click on it closes. Whoever
 * expands it expects a modal — and a modal you can't click away feels broken.
 *
 * In both cases, focus moves into it on open and back to where it came from
 * on close — otherwise you'd end up at the top of the page after closing.
 * And Escape closes it.
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
    // Remember where focus should return to, before it moves.
    const trigger = document.activeElement;
    if (panel && !panel.contains(document.activeElement)) panel.focus();
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, []);

  /**
   * Escape closes the panel — but only if it's the topmost one. If a modal
   * sits above it, the key belongs to that modal. Attached to `document`
   * with capture, so fields and menus inside the panel can intercept it at
   * the `window` level first (that way Escape discards the current input
   * first, not the whole thing right away).
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
   * What the region is for screen readers depends on the state. Role and
   * name live together in one object because they only make sense
   * together: `aria-modal` belongs to the dialog role, and a `region`
   * without a name wouldn't be one at all.
   */
  const semantics = overlay
    ? ({ role: "dialog", "aria-modal": true, "aria-label": label } as const)
    : ({ role: "region", "aria-label": label } as const);

  // The shell is present in both states, only its role in the layout
  // changes. Without it, the panel would move to a different spot in the
  // tree when expanding — React would then rebuild it from scratch, and the
  // view would reload from the beginning.
  return (
    <div className={overlay ? styles.overlay : styles.layer}>
      {/* The backdrop is a button, not a div with `onClick`: this way
          closing is reachable without a mouse too, and it's the same
          structure as in the modal stack (`ModalFrame`). */}
      {overlay && (
        <button
          type="button"
          className={styles.backdrop}
          aria-label={closeLabel}
          onClick={onClose}
        />
      )}
      {/* `tabindex="-1"` doesn't make the region interactive, only
          programmatically focusable — focus has to land somewhere on
          open. */}
      <div ref={ref} className={styles.panel} tabIndex={-1} {...semantics}>
        {children}
      </div>
    </div>
  );
}
