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
 * Guesses an image's MIME type from its URL extension — a linked image is
 * never downloaded, so the file extension is the only clue available.
 * Unknown/missing extension → `null`, the attachment then lands as a
 * generic file card instead of an image preview (see `RichText`'s
 * `attachment` case).
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
