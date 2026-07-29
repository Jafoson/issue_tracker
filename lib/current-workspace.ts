import "server-only";
import { cache } from "react";

// Serverseitiges Pendant zu `lib/session.ts`: `getSession()` liest die aktive
// User-ID aus dem Cookie, hier lesen wir die aktive Workspace-ID. Da diese nur
// in der URL steckt (nicht in einem Cookie), seedet die Route den Wert, und
// verschachtelte Server Components lesen ihn ohne Prop-Drilling.
//
// `cache()` liefert pro Request dieselbe Objekt-Referenz → wir nutzen das als
// request-scoped Speicher. Kein Zustand leckt zwischen Requests.
const store = cache(() => ({ id: null as string | null }));

/**
 * Seedet den Request-Store mit der aktiven Workspace-ID.
 *
 * Muss von **jeder** Route unter `/[workspace]` aufgerufen werden — Layout und
 * Page gleichermaßen. Das Layout allein reicht nicht: bei Client-Navigation
 * innerhalb desselben Segments rendert Next.js nur die Page neu, das Layout
 * bleibt stehen und der Store bliebe leer. Genau das ließ workspace-Queries in
 * Pages nach einem Klick fehlschlagen, während sie nach einem Reload gingen.
 *
 * Idempotent — mehrfaches Setzen im selben Request ist unkritisch.
 */
export function setCurrentWorkspaceId(id: string): void {
  store().id = id;
}

/** Aktive Workspace-ID des Requests, oder `null` außerhalb der App-Shell. */
export function getCurrentWorkspaceId(): string | null {
  return store().id;
}
