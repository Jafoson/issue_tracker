import type { KeyboardEvent } from "react";

/**
 * onKeyDown handler that fires `fn` on Enter or Space — for elements with
 * `role="button"` and `onClick`, so they're also usable via keyboard.
 *
 * Only reacts when the element itself is focused (`target === currentTarget`),
 * so keypresses in nested controls (e.g. buttons, inputs) don't accidentally
 * trigger the container's action.
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
 * The modifier key, named as it's called on this system.
 *
 * Only callable in the browser — on the server there'd be no `navigator`,
 * and a guessed value would cause a mismatch on first hydration. All
 * callers are client components.
 */
export function modKey(): string {
  if (typeof navigator === "undefined") return "Ctrl";
  const platform = navigator.platform || navigator.userAgent;
  return /Mac|iPhone|iPad|iPod/.test(platform) ? "⌘" : "Strg";
}
