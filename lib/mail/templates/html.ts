/**
 * Values in email templates come from the database and ultimately from
 * user input (names, issue titles, comment previews) — unlike JSX, a
 * template string doesn't escape anything on its own. Without this
 * escaping, a title like `<img src=x onerror=...>` could smuggle markup
 * into every recipient's inbox.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** `in_progress` → `In progress` — an approximation of the status name
 *  without falling back on the (per-workspace customizable) status list,
 *  which isn't available here. */
export function humanizeKey(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").trim();
  if (!spaced) return spaced;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * `21. August 2026` — hardcoded to German instead of going through
 * `toLocaleDateString(undefined, …)` like `lib/utils/date.ts`: the
 * `undefined` locale used there needs a browser that has one set. An email
 * is built server-side, without that context — the result would depend on
 * the server's locale instead of being predictable.
 */
export function formatDateDe(date: Date): string {
  return date.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
