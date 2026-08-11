"use client";

import { useEffect } from "react";

/**
 * Hält das Dokument an der Systemeinstellung, solange „System" gewählt ist.
 *
 * Den Startwert setzt das Skript in `Appearance`; hier geht es nur um den
 * Wechsel danach — dunkel am Abend, hell am Morgen, ohne Neuladen. Gerendert
 * wird nichts.
 */
export function AppearanceListener() {
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      document.documentElement.dataset.theme = query.matches ? "light" : "dark";
    };

    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return null;
}
