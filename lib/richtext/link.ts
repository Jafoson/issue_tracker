/**
 * What a link chip derives from its URL.
 *
 * Both go through `new URL(…)` instead of custom expressions: the browser's
 * parser normalizes case, credentials, and special characters, and throws
 * on anything that isn't a URL. What it returns is therefore safe enough to
 * write into a `style` attribute.
 */

/** Only these two schemes have a host an icon could be fetched from. */
const WEB = new Set(["http:", "https:"]);

function parse(href: string): URL | null {
  try {
    return new URL(href);
  } catch {
    return null;
  }
}

/**
 * The name shown on the chip when none was given.
 *
 * `www.` is dropped — it carries no meaning and only costs space in a line
 * that's already narrow.
 */
export function hostOf(href: string): string {
  const url = parse(href);
  if (!url) return href;
  if (!WEB.has(url.protocol)) return href;
  return url.hostname.replace(/^www\./, "");
}

/**
 * The URL of the website's icon — or `null`.
 *
 * Deliberately the site's own `/favicon.ico` and not a service like
 * Google's: such a service would otherwise get to see every linked URL.
 * The price is a lower hit rate — whoever declares their icon only via a
 * `<link rel>` in the page head has none at this path. That's why there's a
 * fallback glyph underneath, see `richText.module.scss`.
 */
export function faviconOf(href: string): string | null {
  const url = parse(href);
  if (!url || !WEB.has(url.protocol)) return null;
  return `${url.origin}/favicon.ico`;
}

/**
 * The `style` attribute for the icon — or `undefined` if there is none.
 *
 * The URL comes from `URL.origin` and is therefore normalized; quotes and
 * parentheses can't occur in it. It's still encoded as a precaution: the
 * document lives in the database, and whatever comes from there is never
 * written unchecked into an attribute.
 */
export function faviconStyle(href: string): string | undefined {
  const icon = faviconOf(href);
  if (!icon) return undefined;
  return `--favicon: url("${encodeURI(icon).replace(/["()]/g, encodeURIComponent)}")`;
}
