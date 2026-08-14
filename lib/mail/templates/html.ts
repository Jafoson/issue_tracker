/**
 * Werte in E-Mail-Vorlagen kommen aus der Datenbank und letztlich von
 * Benutzereingaben (Namen, Issue-Titel, Kommentar-Vorschauen) — anders als
 * JSX escaped ein Template-String nichts von sich aus. Ohne dieses Escaping
 * ließe sich über einen Titel wie `<img src=x onerror=...>` Markup ins
 * Postfach jedes Empfängers schmuggeln.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** `in_progress` → `In progress` — eine Annäherung an den Statusnamen ohne
 *  Rückgriff auf die (pro Workspace anpassbare) Statusliste, die hier nicht
 *  zur Verfügung steht. */
export function humanizeKey(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").trim();
  if (!spaced) return spaced;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * `21. August 2026` — fest auf Deutsch statt über `toLocaleDateString(undefined, …)`
 * wie `lib/utils/date.ts`: das dort verwendete `undefined`-Gebietsschema
 * bräuchte einen Browser, der es hat. Eine Mail wird server-seitig gebaut,
 * ohne diesen Kontext — das Ergebnis wäre vom Server-Locale abhängig statt
 * vorhersagbar.
 */
export function formatDateDe(date: Date): string {
  return date.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
