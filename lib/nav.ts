// Single source of truth for the app's navigation routes — one place that
// knows every URL, icon and label, grouped by area. Both the Sidebar
// (NavGroups) and the TabBar (tabMeta) read from these tables instead of
// each hardcoding their own copy, so a route/icon/label only changes here.
//
// `section` is the URL path segment used to both build hrefs (Sidebar) and
// match the current pathname back to an entry (TabBar): a workspace route
// looks like `/<workspaceId>/<section>`, an admin route `/admin/<section>`,
// a project route `/<workspaceId>/project/<projectSlug>/<section>`.
// `labelKey` is the key under the "nav" i18n namespace (messages/*.json).

export type NavLabelKey =
  | "myIssues"
  | "inbox"
  | "board"
  | "issues"
  | "members"
  | "teams"
  | "settings"
  | "projects"
  | "general"
  | "roles"
  | "labels"
  | "preferences"
  | "workspaces";

export interface NavEntry {
  section: string;
  icon: string;
  labelKey: NavLabelKey;
}

/** Sidebar "Global" group — always visible, not tied to workspace settings. */
export const GLOBAL_NAV: NavEntry[] = [
  { section: "my", icon: "lucide:user", labelKey: "myIssues" },
  { section: "projects", icon: "lucide:folders", labelKey: "projects" },
];

/**
 * Sidebar "Workspace" group — workspace administration.
 *
 * Rollen stehen hier nicht mehr: sie sind eine Einrichtungsfrage und liegen in
 * den Einstellungen (`WORKSPACE_SETTINGS_NAV`). Mitglieder und Teams bleiben,
 * weil man sie im Alltag nachschlägt — beide sind zusätzlich in den
 * Einstellungen erreichbar, dieselbe Ansicht in einem anderen Rahmen.
 */
export const WORKSPACE_NAV: NavEntry[] = [
  { section: "members", icon: "lucide:users", labelKey: "members" },
  { section: "teams", icon: "lucide:users-round", labelKey: "teams" },
  { section: "settings", icon: "lucide:settings", labelKey: "settings" },
];

/** Real route with its own tab metadata, but not (yet) linked from the Sidebar. */
export const INBOX_NAV: NavEntry = {
  section: "inbox",
  icon: "lucide:inbox",
  labelKey: "inbox",
};

/**
 * Die Rollen-Seite gibt es weiter unter `/<workspaceId>/roles` — sie steht nur
 * nicht mehr in der Seitenleiste. Der Eintrag bleibt, damit ein offener Reiter
 * oder ein geteilter Link seinen Namen und sein Zeichen behält.
 */
export const ROLES_NAV: NavEntry = {
  section: "roles",
  icon: "lucide:shield-check",
  labelKey: "roles",
};

/** All sections that live directly under `/<workspaceId>/…` — used by the TabBar to resolve any workspace-scoped tab. */
export const WORKSPACE_SECTIONS: NavEntry[] = [
  ...GLOBAL_NAV,
  ...WORKSPACE_NAV,
  INBOX_NAV,
  ROLES_NAV,
];

/** Sidebar "Admin" group — `/admin` (empty section = root) or `/admin/<section>`. */
export const ADMIN_NAV: NavEntry[] = [
  { section: "", icon: "lucide:settings", labelKey: "general" },
  { section: "members", icon: "lucide:users", labelKey: "members" },
  { section: "roles", icon: "lucide:shield-check", labelKey: "roles" },
];

/**
 * Per-project sub-nav — `/<workspaceId>/project/<slug>` (empty section = board)
 * or `/<workspaceId>/project/<slug>/<section>`.
 *
 * Mitglieder stehen hier und nicht in den Einstellungen: wer im Projekt
 * arbeitet, schlägt dort nach, wen er ansprechen kann — das ist eine Frage des
 * Alltags, keine Einstellung. Rollen und Labels sind es, und sie hängen deshalb
 * unter `settings` (`PROJECT_SETTINGS_NAV`).
 */
export const PROJECT_NAV: NavEntry[] = [
  { section: "", icon: "lucide:layout-dashboard", labelKey: "board" },
  { section: "list", icon: "lucide:list", labelKey: "issues" },
  { section: "members", icon: "lucide:users", labelKey: "members" },
  { section: "settings", icon: "lucide:settings", labelKey: "settings" },
];

/**
 * Die Bereiche der Projekteinstellungen — `…/project/<slug>/settings/<section>`,
 * leere Sektion = Allgemein.
 *
 * Gerendert wird die Leiste von `ProjectSettingsNav`, die Sichtbarkeit einzelner
 * Einträge entscheidet das Layout anhand der Rechte.
 */
export const PROJECT_SETTINGS_NAV: NavEntry[] = [
  { section: "", icon: "lucide:settings", labelKey: "general" },
  // Dieselbe Seite wie unter `…/project/<slug>/members`: wer Mitglieder sucht,
  // sucht sie mal beim Projekt und mal in dessen Einstellungen — beides führt
  // hin. Erst die Leute, dann ihre Rechte, dann die Labels.
  { section: "members", icon: "lucide:users", labelKey: "members" },
  { section: "roles", icon: "lucide:shield-check", labelKey: "roles" },
  { section: "labels", icon: "lucide:tag", labelKey: "labels" },
];

/**
 * Die Bereiche der Workspace-Einstellungen — `/<workspaceId>/settings/<section>`,
 * leere Sektion = Allgemein.
 *
 * Dieselbe zweite Ebene wie beim Projekt (`PROJECT_SETTINGS_NAV`), eine Stufe
 * höher: hier steht, was für den ganzen Workspace gilt. Mitglieder und Teams
 * sind zusätzlich direkt unter `/<workspaceId>/…` erreichbar — wer im Workspace
 * arbeitet, schlägt sie dort nach, wer ihn einrichtet, findet sie hier neben
 * Rollen und Labels. Geteilt wird die Komponente, nicht die Route.
 */
export const WORKSPACE_SETTINGS_NAV: NavEntry[] = [
  { section: "", icon: "lucide:settings", labelKey: "general" },
  { section: "projects", icon: "lucide:folders", labelKey: "projects" },
  { section: "labels", icon: "lucide:tag", labelKey: "labels" },
  { section: "teams", icon: "lucide:users-round", labelKey: "teams" },
  { section: "roles", icon: "lucide:shield-check", labelKey: "roles" },
  { section: "members", icon: "lucide:users", labelKey: "members" },
  // Erscheinungsbild und Sprache gehören dem Benutzer, nicht dem Workspace —
  // sie stehen deshalb am Ende, hinter allem, was für alle gilt.
  { section: "preferences", icon: "lucide:palette", labelKey: "preferences" },
];

export function workspacePath(workspaceId: string, section: string): string {
  return section ? `/${workspaceId}/${section}` : `/${workspaceId}`;
}

/** Ein Bereich der Workspace-Einstellungen. Leere Sektion = Allgemein. */
export function workspaceSettingsPath(
  workspaceId: string,
  section: string,
): string {
  const base = workspacePath(workspaceId, "settings");
  return section ? `${base}/${section}` : base;
}

export function adminPath(section: string): string {
  return section ? `/admin/${section}` : "/admin";
}

export function projectPath(
  workspaceId: string,
  slug: string,
  section: string,
): string {
  const base = `/${workspaceId}/project/${slug}`;
  return section ? `${base}/${section}` : base;
}

/** Ein Bereich der Projekteinstellungen. Leere Sektion = Allgemein. */
export function projectSettingsPath(
  workspaceId: string,
  slug: string,
  section: string,
): string {
  const base = projectPath(workspaceId, slug, "settings");
  return section ? `${base}/${section}` : base;
}

/**
 * Ist `pathname` der Eintrag, den `pattern` meint?
 *
 * Normalerweise exakt — ein Eintrag ist aktiv, wenn man auf ihm steht. Endet
 * das Muster auf `/*`, gilt auch alles darunter: die „Einstellungen" bleiben
 * markiert, während man in ihren Bereichen blättert, und die Seitenleiste
 * klappt den Zweig nicht unter einem zu.
 *
 * Steht hier statt in der Seitenleiste, weil `NavLink` (Markierung) und
 * `TabList` (Aufklappen) dieselbe Antwort brauchen — zwei Auslegungen desselben
 * Musters wären genau der Fehler, den man erst spät bemerkt.
 */
export function isNavActive(
  pathname: string,
  href: string,
  activeHref?: string,
): boolean {
  const pattern = activeHref ?? href;
  if (!pattern.endsWith("/*")) return pathname === pattern;

  const base = pattern.slice(0, -2);
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function findBySection(
  entries: NavEntry[],
  section: string,
): NavEntry | undefined {
  return entries.find((e) => e.section === section);
}
