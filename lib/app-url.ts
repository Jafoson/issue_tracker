import "server-only";

/**
 * Schema und Host der Anwendung, ohne abschließenden Schrägstrich.
 *
 * Die Basis kommt aus der Umgebung, nicht aus dem Request: Adressen, die damit
 * entstehen, werden kopiert und woanders geöffnet — ein relativer Pfad taugt
 * dafür nicht, und hinter einem Proxy ist der Host des Requests nicht der, unter
 * dem die App erreichbar ist. `AUTH_URL` ist gesetzt, weil Auth.js sie ohnehin
 * braucht; `NEXTAUTH_URL` und der lokale Fallback stehen daneben, damit die
 * Funktion nirgends leer ausgeht.
 */
export function appBaseUrl(): string {
  return (
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

/** Eine absolute Adresse aus einem Pfad der App (`/…`). */
export function appUrl(path: string): string {
  return `${appBaseUrl()}${path}`;
}
