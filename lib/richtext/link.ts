/**
 * Was ein Link-Chip aus seiner Adresse ableitet.
 *
 * Beides läuft über `new URL(…)` statt über eigene Ausdrücke: der Parser des
 * Browsers normalisiert Groß-/Kleinschreibung, Zugangsdaten und Sonderzeichen
 * und wirft bei allem, was keine Adresse ist. Was er zurückgibt, ist damit
 * sicher genug, um es in ein `style`-Attribut zu schreiben.
 */

/** Nur diese beiden Schemata haben einen Host, von dem sich ein Icon holen ließe. */
const WEB = new Set(["http:", "https:"]);

function parse(href: string): URL | null {
  try {
    return new URL(href);
  } catch {
    return null;
  }
}

/**
 * Der Name, der im Chip steht, wenn keiner angegeben wurde.
 *
 * `www.` fällt weg — es trägt keine Bedeutung und kostet nur Platz in einer
 * Zeile, die ohnehin schmal ist.
 */
export function hostOf(href: string): string {
  const url = parse(href);
  if (!url) return href;
  if (!WEB.has(url.protocol)) return href;
  return url.hostname.replace(/^www\./, "");
}

/**
 * Die Adresse des Website-Icons — oder `null`.
 *
 * Bewusst `/favicon.ico` der Seite selbst und kein Dienst wie der von Google:
 * ein solcher Dienst bekäme sonst jede verlinkte Adresse zu sehen. Der Preis
 * ist eine geringere Trefferquote — wer sein Icon nur über ein `<link rel>`
 * im Kopf der Seite angibt, hat keines unter diesem Pfad. Deshalb liegt
 * darunter ein Ersatzzeichen, siehe `richText.module.scss`.
 */
export function faviconOf(href: string): string | null {
  const url = parse(href);
  if (!url || !WEB.has(url.protocol)) return null;
  return `${url.origin}/favicon.ico`;
}

/**
 * Das `style`-Attribut für das Icon — oder `undefined`, wenn es keines gibt.
 *
 * Die Adresse kommt aus `URL.origin` und ist damit normalisiert; Anführungs-
 * zeichen und Klammern können darin nicht vorkommen. Zur Sicherheit werden sie
 * trotzdem kodiert: das Dokument liegt in der Datenbank, und was von dort
 * kommt, wird nie ungeprüft in ein Attribut geschrieben.
 */
export function faviconStyle(href: string): string | undefined {
  const icon = faviconOf(href);
  if (!icon) return undefined;
  return `--favicon: url("${encodeURI(icon).replace(/["()]/g, encodeURIComponent)}")`;
}
