"use client";

import { useCallback, useState } from "react";

/**
 * Ein Ja/Nein, das die Sitzung überdauert, aber nicht länger.
 *
 * Gedacht für Ansichtsentscheidungen, die man einmal trifft und dann eine Weile
 * behalten will — etwa ob die Issue-Detailansicht als Seitenpanel oder als
 * großer Dialog aufgeht. Solche Entscheidungen überleben zu Recht den Wechsel
 * zwischen Liste und Board (die Komponente dahinter wird dabei neu montiert),
 * aber nicht den nächsten Besuch: dort fängt man wieder mit dem Normalfall an.
 * Deshalb `sessionStorage` und nicht `localStorage`.
 *
 * Gelesen wird beim ersten Render, nicht in einem Effekt — sonst stünde für
 * einen Frame der falsche Wert. Das geht hier gefahrlos, weil nur Client-Bäume
 * den Hook verwenden; serverseitig fällt er auf `fallback` zurück.
 */
export function useSessionFlag(key: string, fallback = false) {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return fallback;
    try {
      const stored = window.sessionStorage.getItem(key);
      return stored === null ? fallback : stored === "true";
    } catch {
      // Speicher gesperrt (privater Modus, strenge Einstellungen) — dann eben
      // ohne Gedächtnis. Ein Ansichtsdetail ist keinen Absturz wert.
      return fallback;
    }
  });

  const set = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        window.sessionStorage.setItem(key, String(next));
      } catch {
        // Siehe oben: der Zustand gilt dann nur für diese Montierung.
      }
    },
    [key],
  );

  return [value, set] as const;
}
