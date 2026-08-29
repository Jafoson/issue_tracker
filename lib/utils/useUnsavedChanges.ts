"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Keeps the user on the page as long as something unsaved is open.
 *
 * ```tsx
 * const confirm = useConfirm()
 * useUnsavedChanges(pending.size > 0, () =>
 *   confirm({ title: t("leaveTitle"), … }),
 * )
 * ```
 *
 * Three paths lead away from a page, and each needs its own brake:
 *
 *   1. **Leaving the document** — reload, close the tab, an external URL.
 *      Only `beforeunload` exists for this; the dialog's text belongs to
 *      the browser, `confirmLeave` never gets a say here.
 *   2. **A link within the app.** The click is intercepted in the capture
 *      phase, before the router sees it; only after a yes does the router
 *      itself navigate.
 *   3. **Back and forward.** A back step can't be stopped, only answered
 *      after the fact — that's why, from the first change on, a copy of
 *      the current entry sits on the history stack. The first back step
 *      consumes the copy and lands right back here; only after a yes does
 *      it actually go back.
 *
 * The copy is left in place after saving — cleaning it up again would mean
 * moving the history, and from here that can't reliably be told apart from
 * a real navigation. The price is one back step that does nothing once;
 * saving that step wouldn't be worth the risk of accidentally undoing
 * someone else's navigation.
 *
 * `confirmLeave` answers "really leave?" with `true`/`false`. The caller
 * doesn't clean up the unsaved changes itself: the page disappears anyway,
 * and the next visit shows the server's state again.
 */
export function useUnsavedChanges(
  dirty: boolean,
  confirmLeave: () => Promise<boolean>,
) {
  const router = useRouter();

  // The listeners are attached for the whole lifetime and read the current
  // state out of here — otherwise every single change would need its own
  // unregister-and-reregister.
  const state = useRef({ dirty, confirmLeave });
  useEffect(() => {
    state.current = { dirty, confirmLeave };
  });

  // Set while we're moving the history ourselves (point 3). A question
  // that's already been answered must not be asked a second time — neither
  // by us nor by the browser.
  const leaving = useRef(false);

  // ── 1. Leaving the document ────────────────────────────────────────────────
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leaving.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // ── 2. Links within the app ─────────────────────────────────────────────────
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!state.current.dirty) return;
      // Middle click, ⌘/Ctrl/Shift/Alt: the browser then opens a new tab
      // or a new window — this page stays as it is.
      if (event.button !== 0 || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, location.href);
      // A different origin means: the document is being left, and
      // `beforeunload` already handles that. The same URL isn't a
      // navigation at all.
      if (url.origin !== location.origin) return;
      if (url.href === location.href) return;

      event.preventDefault();
      // The other listeners on the document shouldn't see this click
      // either: the navigation is cancelled, not deferred. Only after the
      // answer does it proceed — and then through the router.
      event.stopImmediatePropagation();

      void state.current.confirmLeave().then((leave) => {
        if (leave) router.push(url.pathname + url.search + url.hash);
      });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  // ── 3. Back and forward ──────────────────────────────────────────────────────

  // The copy is placed once per visit, not on every switch from "clean" to
  // "changed" — otherwise the history would grow a dead entry with every
  // click in the matrix.
  const copied = useRef(false);

  useEffect(() => {
    if (!dirty || copied.current) return;
    copied.current = true;
    history.pushState(history.state, "", location.href);
  }, [dirty]);

  useEffect(() => {
    const onPopState = () => {
      // This step came from us — the question has long since been answered.
      if (leaving.current) {
        leaving.current = false;
        return;
      }
      if (!state.current.dirty) return;

      void state.current.confirmLeave().then((leave) => {
        // The copy is consumed by the back step: either it now goes one
        // step further back — where the page the user actually wanted
        // lives — or a new copy takes its place.
        if (leave) {
          leaving.current = true;
          history.back();
        } else {
          history.pushState(history.state, "", location.href);
        }
      });
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
}
