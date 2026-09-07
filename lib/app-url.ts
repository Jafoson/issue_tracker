/**
 * Scheme and host of the application, without a trailing slash.
 *
 * The base comes from the environment, not from the request: URLs built
 * with it get copied and opened elsewhere — a relative path won't do for
 * that, and behind a proxy the request's host isn't the one the app is
 * actually reachable at. `AUTH_URL` is used because Auth.js needs it anyway;
 * `NEXTAUTH_URL` and the local fallback sit alongside it so the function
 * never comes up empty.
 *
 * Deliberately without `server-only`: neither env var is secret, and
 * `lib/mail/templates/layout.ts` (via `appUrl()`, for the logo's absolute
 * URL) is imported by every template in `lib/mail/templates/*`, which in
 * turn `features/mail-templates/preview.ts` renders live from the
 * `"use client"` admin editor — a `server-only` guard anywhere in that
 * chain breaks the client bundle. On the client, both env vars are simply
 * absent and the function falls back to the `http://localhost:3000`
 * default, which only matters for that in-browser preview, never for a
 * mail actually sent (always rendered server-side).
 */
export function appBaseUrl(): string {
  return (
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

/** An absolute URL built from an app path (`/…`). */
export function appUrl(path: string): string {
  return `${appBaseUrl()}${path}`;
}
