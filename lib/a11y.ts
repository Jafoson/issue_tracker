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
