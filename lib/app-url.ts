import "server-only";

/**
 * Scheme and host of the application, without a trailing slash.
 *
 * The base comes from the environment, not from the request: URLs built
 * with it get copied and opened elsewhere — a relative path won't do for
 * that, and behind a proxy the request's host isn't the one the app is
 * actually reachable at. `AUTH_URL` is used because Auth.js needs it anyway;
 * `NEXTAUTH_URL` and the local fallback sit alongside it so the function
 * never comes up empty.
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
