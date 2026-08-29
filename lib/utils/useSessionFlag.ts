"use client";

import { useCallback, useState } from "react";

/**
 * A yes/no that outlives the session, but no longer.
 *
 * Meant for view decisions made once and then kept around for a while —
 * say, whether the issue detail view opens as a side panel or as a large
 * dialog. Such decisions rightly survive switching between list and board
 * (the component behind them gets remounted in the process), but not the
 * next visit: there you start over with the normal case. That's why
 * `sessionStorage` and not `localStorage`.
 *
 * Read on the first render, not in an effect — otherwise the wrong value
 * would show for one frame. That's safe here because only client trees use
 * this hook; on the server it falls back to `fallback`.
 */
export function useSessionFlag(key: string, fallback = false) {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return fallback;
    try {
      const stored = window.sessionStorage.getItem(key);
      return stored === null ? fallback : stored === "true";
    } catch {
      // Storage blocked (private mode, strict settings) — fine, no memory
      // then. A view detail isn't worth crashing over.
      return fallback;
    }
  });

  const set = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        window.sessionStorage.setItem(key, String(next));
      } catch {
        // See above: the state then only applies to this mount.
      }
    },
    [key],
  );

  return [value, set] as const;
}
