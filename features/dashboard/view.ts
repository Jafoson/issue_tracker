// ─── Die beiden Ansichten der Projektseite ───────────────────────────────────
//
// Abhängigkeitsfrei: kein React, keine DB. Die Seite (Server Component) braucht
// die Umwandlung, die Oberfläche den Typ, und die Tests keins von beidem.
// Dasselbe Muster wie `toRange` in `lib/buckets.ts`.

/** Steht als `?view=` in der Adresse und in `DashboardPreference.view`. */
export const PROJECT_VIEWS = ["profile", "dashboard"] as const;

export type ProjectView = (typeof PROJECT_VIEWS)[number];

/**
 * Womit die Projektseite aufgeht, wenn niemand etwas gewählt hat.
 *
 * Der Steckbrief und nicht die Zahlen: er beantwortet „was ist das hier", und
 * das ist die Frage dessen, der ein Projekt zum ersten Mal öffnet. Wer die
 * Zahlen will, schaltet einmal um — und ab dann merkt sich das die Seite
 * (`DashboardPreference.view`).
 */
export const DEFAULT_PROJECT_VIEW: ProjectView = "profile";

/**
 * Einen Wert aus Adresse oder Datenbank auf eine bekannte Ansicht bringen.
 *
 * Fällt auf die Vorgabe zurück statt zu werfen: ein Tippfehler in einem
 * Parameter, der nur die Darstellung wählt, ist kein Grund für eine 404. Mehrere
 * Kandidaten dürfen der Reihe nach hereingereicht werden — der erste bekannte
 * gewinnt. Das ist genau die Rangfolge der Seite: was in der Adresse steht,
 * schlägt das, was im Konto vermerkt ist.
 */
export function toProjectView(
  ...candidates: (string | null | undefined)[]
): ProjectView {
  for (const value of candidates) {
    if ((PROJECT_VIEWS as readonly string[]).includes(value ?? "")) {
      return value as ProjectView;
    }
  }
  return DEFAULT_PROJECT_VIEW;
}
