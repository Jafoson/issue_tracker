// ─── Der Umfang eines Dashboards ──────────────────────────────────────────────
//
// Abhängigkeitsfrei: kein React, keine DB. Dasselbe Muster wie `view.ts`
// nebenan und wie `toRange` in `lib/buckets.ts`.

/** Steht als `?scope=` in der Adresse und in `DashboardPreference.scope`. */
export const DASHBOARD_SCOPES = ["all", "mine"] as const;

export type DashboardScope = (typeof DASHBOARD_SCOPES)[number];

/**
 * Womit das Dashboard aufgeht, wenn niemand etwas gewählt hat.
 *
 * Wer `dashboard.view.all` nicht trägt, bekommt diese Vorgabe ohnehin
 * überschrieben (`getProjectDashboard`/`getWorkspaceDashboard` erzwingen
 * `"mine"`) — sie gilt also nur für die, die überhaupt wählen dürfen.
 */
export const DEFAULT_DASHBOARD_SCOPE: DashboardScope = "all";

/**
 * Einen Wert aus Adresse oder Datenbank auf einen bekannten Umfang bringen.
 *
 * Fällt auf die Vorgabe zurück statt zu werfen: ein Tippfehler in einem
 * Parameter, der nur die Darstellung wählt, ist kein Grund für eine 404. Mehrere
 * Kandidaten dürfen der Reihe nach hereingereicht werden — der erste bekannte
 * gewinnt, wie bei `toProjectView`.
 */
export function toDashboardScope(
  ...candidates: (string | null | undefined)[]
): DashboardScope {
  for (const value of candidates) {
    if ((DASHBOARD_SCOPES as readonly string[]).includes(value ?? "")) {
      return value as DashboardScope;
    }
  }
  return DEFAULT_DASHBOARD_SCOPE;
}
