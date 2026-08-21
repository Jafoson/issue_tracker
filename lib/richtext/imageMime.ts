const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  avif: "image/avif",
};

/**
 * Rät den MIME-Type eines Bildes an seiner URL-Endung — ein verlinktes Bild
 * wird nie heruntergeladen, also bleibt nur die Dateiendung als Hinweis.
 * Unbekannte/fehlende Endung → `null`, der Anhang landet dann als generische
 * Datei-Karte statt als Bildvorschau (siehe `RichText`'s `attachment`-Fall).
 */
export function guessImageMimeType(url: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url;
  }
  const match = /\.([a-z0-9]+)$/i.exec(pathname);
  if (!match) return null;
  return EXT_MIME[match[1].toLowerCase()] ?? null;
}
