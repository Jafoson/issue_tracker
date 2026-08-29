// ─── The project page's two views ───────────────────────────────────────────
//
// Dependency-free: no React, no DB. The page (server component) needs the
// conversion, the UI needs the type, and the tests need neither. Same
// pattern as `toRange` in `lib/buckets.ts`.

/** Appears as `?view=` in the address and in `DashboardPreference.view`. */
export const PROJECT_VIEWS = ["profile", "dashboard"] as const;

export type ProjectView = (typeof PROJECT_VIEWS)[number];

/**
 * What the project page opens with when nobody has chosen anything.
 *
 * The profile card, not the numbers: it answers "what is this", and that's
 * the question of someone opening a project for the first time. Anyone who
 * wants the numbers switches once — and from then on the page remembers that
 * (`DashboardPreference.view`).
 */
export const DEFAULT_PROJECT_VIEW: ProjectView = "profile";

/**
 * Bring a value from the address or the database to a known view.
 *
 * Falls back to the default instead of throwing: a typo in a parameter that
 * only picks the display is no reason for a 404. Multiple candidates may be
 * passed in in order — the first known one wins. That's exactly the page's
 * order of precedence: what's in the address beats what's recorded in the
 * account.
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
