"use client";

import { useEffect, useState } from "react";

/**
 * Firefox reports mouse wheel notches in lines instead of pixels — without
 * conversion, each notch would come out as a jump of just three pixels.
 */
const LINE = 16;

/** The wheel delta in pixels, whatever unit the browser delivers it in. */
function pixels(e: WheelEvent, page: number) {
  // With Shift held, some browsers redirect the motion onto the X axis on
  // their own. So whichever axis actually carries the movement is the one
  // that counts.
  const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) return delta * LINE;
  if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) return delta * page;
  return delta;
}

/**
 * Shift + mouse wheel scrolls the container horizontally — across its
 * entire area, even where a child under the pointer scrolls vertically on
 * its own.
 *
 * Without this, the column under the pointer on the board takes over the
 * movement: it's the nearest scroll container, and whether the browser even
 * remaps Shift + wheel to horizontal scrolling varies from browser to
 * browser. The gesture would then only work in the gaps between columns —
 * which is to say, almost nowhere.
 *
 * ```tsx
 * const ref = useShiftScroll()
 * return <div ref={ref} className={styles.board}>…</div>
 * ```
 *
 * The listener is attached to the element by hand instead of as an
 * `onWheel` prop: React registers wheel events passively, and passive means
 * `preventDefault` has no effect.
 */
export function useShiftScroll() {
  // The element as state, not as a ref: only this way does the effect find
  // out about it and attach its listener.
  const [element, setElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!element) return;

    const onWheel = (e: WheelEvent) => {
      // Ctrl + wheel is the browser's zoom, the other combinations belong
      // to the system — Shift alone is the gesture.
      if (!e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
      // If everything's already side by side, there's nothing to scroll;
      // then the browser keeps its usual behavior.
      if (element.scrollWidth <= element.clientWidth) return;

      const delta = pixels(e, element.clientWidth);
      if (delta === 0) return;

      e.preventDefault();
      // Once it hits the edge, the movement is simply dropped instead of
      // being passed along: a board that can't scroll any further
      // shouldn't suddenly start scrolling a column vertically either.
      element.scrollLeft += delta;
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [element]);

  return setElement;
}
