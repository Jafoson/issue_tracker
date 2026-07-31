import type { KeyboardEvent } from "react";

/**
 * onKeyDown-Handler, der `fn` bei Enter oder Leertaste auslöst — für Elemente
 * mit `role="button"` und `onClick`, damit sie auch per Tastatur bedienbar sind.
 *
 * Reagiert nur, wenn das Element selbst fokussiert ist (`target === currentTarget`),
 * damit Tastendrücke in verschachtelten Controls (z. B. Buttons, Inputs) nicht
 * versehentlich die Container-Aktion auslösen.
 */
export function onActivate<T extends Element = Element>(fn: () => void) {
  return (e: KeyboardEvent<T>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
}

/**
 * Die Modifikatortaste, wie sie auf diesem System heißt.
 *
 * Nur im Browser aufrufbar — auf dem Server gäbe es kein `navigator`, und ein
 * geratener Wert führte beim ersten Abgleich zu einer Abweichung. Alle
 * Aufrufer sind Client-Komponenten.
 */
export function modKey(): string {
  if (typeof navigator === "undefined") return "Ctrl";
  const platform = navigator.platform || navigator.userAgent;
  return /Mac|iPhone|iPad|iPod/.test(platform) ? "⌘" : "Strg";
}
