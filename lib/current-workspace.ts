import "server-only";
import { cache } from "react";

// Serverseitiges Pendant zu `lib/session.ts`: `getSession()` liest die aktive
// User-ID aus dem Cookie, hier lesen wir die aktive Workspace-ID. Da diese nur in
// der URL steckt (nicht in einem Cookie), seedet das App-Layout den Wert einmalig
// und verschachtelte Server Components lesen ihn ohne Prop-Drilling.
//
// `cache()` liefert pro Request dieselbe Objekt-Referenz → wir nutzen das als
// request-scoped Speicher. Kein Zustand leckt zwischen Requests.
const store = cache(() => ({ id: null as string | null }));

/** Wird vom App-Layout mit der aktiven Workspace-ID des Requests aufgerufen. */
export function setCurrentWorkspaceId(id: string): void {
  store().id = id;
}

/** Aktive Workspace-ID des Requests, oder `null` außerhalb der App-Shell. */
export function getCurrentWorkspaceId(): string | null {
  return store().id;
}
