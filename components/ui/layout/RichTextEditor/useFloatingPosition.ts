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
 * Positions a free-floating popover (address bar, attachment dialog) against
 * a reference point — the clicked toolbar button, or, without a click, a
 * virtual element at the cursor — and steers around a lack of space at the
 * window edge instead of running past it.
 *
 * Same principle as `props.mount` from `@tiptap/suggestion` for the `/`
 * menu (that also runs through Floating UI), just for popovers outside the
 * suggestion plugin that have no text position in the document.
 */
export function useFloatingPosition(
  reference: ReferenceElement | null,
  // Triggers a recomputation even when `reference` stays the same object —
  // e.g. when the attachment dialog switches from the picker to the URL
  // form: different size, but the same reference point.
  recomputeKey?: unknown,
) {
  const floatingRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{
    left: number;
    top: number;
    visibility: "visible" | "hidden";
  }>({ left: 0, top: 0, visibility: "hidden" });

  // Without releasing visibility only after measuring, the popover briefly
  // flashes in the top-left corner before jumping to its actual place.
  useLayoutEffect(() => {
    // Forces the recomputation below even when `reference` stays the same
    // object (see the comment on the parameter).
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
      // `fixed`, not the default `absolute` — `.floatingLayer` itself is
      // attached to the body via `position: fixed`, so a scrolling editor
      // doesn't drag it along.
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
