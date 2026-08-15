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

import type { Permission } from "@/lib/rbac";

export type NavLabelKey =
  | "myIssues"
  | "dashboard"
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
  | "workspaces"
  | "account"
  | "appearance"
  | "notifications"
  | "security"
  | "connections"
  | "admin"
  | "overview"
  | "users"
  | "audit"
  | "mailTemplates";

export interface NavEntry {
  section: string;
  icon: string;
  labelKey: NavLabelKey;
  /**
   * Recht(e), ohne die der Eintrag nicht erscheint. Ohne Angabe steht er allen
   * offen, die den Bereich überhaupt betreten dürfen. Mehrere Rechte sind ein
   * ODER — der Eintrag erscheint, sobald eines davon greift (z. B. "Einstellungen":
   * sichtbar für wer auch immer dort etwas ändern kann, egal was).
   *
   * Geprüft wird das über `navEntryAllowed()`. Die Sichtbarkeit ist trotzdem
   * kein Schutz — nur Höflichkeit, kein Eintrag, der beim Anklicken auf eine
   * 403-Seite führt. Die eigentliche Prüfung sitzt in der Abfrage dahinter
   * (`features/admin/queries.ts`, `features/workspaces/queries.ts`, …), bei
   * jedem Aufruf neu.
   */
  permission?: Permission | Permission[];
}

/** Darf ein Nav-Eintrag angeboten werden? Kein Recht verlangt = immer ja. */
export function navEntryAllowed(
  has: (permission: Permission) => boolean,
  entry: Pick<NavEntry, "permission">,
): boolean {
  if (!entry.permission) return true;
  const required = Array.isArray(entry.permission)
    ? entry.permission
    : [entry.permission];
  return required.some(has);
}

/**
 * Die Startseite des Workspace, in zwei Ansichten — `/<workspaceId>` (leere
 * Sektion) und `/<workspaceId>/dashboard`. Anders als beim Projekt
 * (`PROJECT_OVERVIEW_NAV`, das unter `/overview` steht, weil die Wurzel dort
 * schon das Board ist) hat der Workspace keine Wurzel, die ihm streitig macht —
 * die Übersicht bekommt sie deshalb direkt. Beide Ansichten stehen als eigener
 * Navlink in der Seitenleiste: es gibt keine Zeile, die beide meint und sich
 * merken müsste, welche zuletzt offen war.
 */
export const WORKSPACE_OVERVIEW_NAV: NavEntry = {
  section: "",
  icon: "lucide:info",
  labelKey: "overview",
};

export const WORKSPACE_DASHBOARD_NAV: NavEntry = {
  section: "dashboard",
  icon: "lucide:layout-dashboard",
  labelKey: "dashboard",
};

/** Sidebar "Global" group — always visible, not tied to workspace settings. */
export const GLOBAL_NAV: NavEntry[] = [
  { section: "my", icon: "lucide:user", labelKey: "myIssues" },
  { section: "projects", icon: "lucide:folders", labelKey: "projects" },
];

/**
 * Wer eines dieser Rechte trägt, kann in den Einstellungen des jeweiligen
 * Scopes etwas ändern — sonst wären sie nur schreibgeschützte Ansichten.
 * Dieselbe Regel entscheidet über den Tab in der Seitenleiste
 * (`WORKSPACE_NAV`/`PROJECT_NAV`) UND über das Segment im Umschalter
 * (`SettingsHeader`, siehe die drei `settings/layout.tsx`) — eine Quelle für
 * beide, statt die Liste zweimal zu pflegen.
 */
export const WORKSPACE_SETTINGS_PERMISSIONS: Permission[] = [
  "role.manage",
  "label.create",
  "workspace.update",
];
export const PROJECT_SETTINGS_PERMISSIONS: Permission[] = [
  "role.manage",
  "label.create",
  "project.update",
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
  {
    section: "members",
    icon: "lucide:users",
    labelKey: "members",
    permission: "member.view",
  },
  // Teams bekommen kein Gate: ohne team.view.all sieht man die eigenen statt
  // aller (`getWorkspaceTeamsView`) — der Tab bleibt sichtbar, nur der Inhalt
  // ist gefiltert.
  { section: "teams", icon: "lucide:users-round", labelKey: "teams" },
  {
    section: "settings",
    icon: "lucide:settings",
    labelKey: "settings",
    permission: WORKSPACE_SETTINGS_PERMISSIONS,
  },
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

/**
 * Die eigenen Einstellungen — `/<workspaceId>/account/…`.
 *
 * Sie stehen in keiner Seitenleiste: erreichbar sind sie über das eigene Menü
 * unten links, dort, wo der eigene Name steht. Der Eintrag existiert trotzdem,
 * weil ein offener Reiter und ein geteilter Link einen Namen und ein Zeichen
 * brauchen — dieselbe Rolle wie `ROLES_NAV`.
 *
 * Der Bereich hängt unter dem Workspace, obwohl nichts darin dem Workspace
 * gehört: die App kennt außerhalb der Workspace-Hülle keine Seitenleiste, keine
 * Reiterleiste und keinen Weg zurück. Welcher Workspace in der Adresse steht,
 * ist für den Inhalt ohne Bedeutung.
 */
export const ACCOUNT_NAV: NavEntry = {
  section: "account",
  icon: "lucide:circle-user",
  labelKey: "account",
};

/** All sections that live directly under `/<workspaceId>/…` — used by the TabBar to resolve any workspace-scoped tab. */
export const WORKSPACE_SECTIONS: NavEntry[] = [
  WORKSPACE_OVERVIEW_NAV,
  WORKSPACE_DASHBOARD_NAV,
  ...GLOBAL_NAV,
  ...WORKSPACE_NAV,
  INBOX_NAV,
  ROLES_NAV,
  ACCOUNT_NAV,
];

/**
 * Die Bereiche der Plattformverwaltung — `/admin` (leere Sektion = Übersicht)
 * oder `/admin/<section>`.
 *
 * Die Reihenfolge ist die des Zugriffs, von innen nach außen: erst der Zustand
 * der Plattform, dann die Konten, dann die Projekte, die ihnen gehören, dann die
 * Rollen, die alles davon regeln — und am Ende das Protokoll, in dem steht, was
 * hier getan wurde.
 *
 * Was in dieser Liste steht, ist die Hülle des Systems: Konten, Stammdaten,
 * Rechte, Protokoll. Inhalte — Aufgaben, Kommentare, Anhänge — stehen bewusst
 * nicht darin und sind von hier aus auch nicht erreichbar. Wer hineinsehen muss,
 * geht über den Notfall-Zugriff (`features/admin/actions.ts`).
 */
export const ADMIN_NAV: NavEntry[] = [
  { section: "", icon: "lucide:layout-dashboard", labelKey: "overview" },
  {
    section: "users",
    icon: "lucide:users",
    labelKey: "users",
    permission: "user.manage",
  },
  {
    // Ohne eigene Leseberechtigung: die Mandantenliste zeigt nichts, was das
    // Dashboard nicht schon zeigt. Was man mit einem Workspace *tun* darf,
    // entscheiden `workspace.suspend` und `workspace.delete` in der Ansicht.
    section: "workspaces",
    icon: "lucide:building-2",
    labelKey: "workspaces",
  },
  {
    section: "projects",
    icon: "lucide:folders",
    labelKey: "projects",
    permission: "project.metadata.view",
  },
  {
    section: "roles",
    icon: "lucide:shield-check",
    labelKey: "roles",
    permission: "role.manage",
  },
  {
    section: "audit",
    icon: "lucide:scroll-text",
    labelKey: "audit",
    permission: "audit.view",
  },
  {
    section: "mail-templates",
    icon: "lucide:mail",
    labelKey: "mailTemplates",
    permission: "mail.template.manage",
  },
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
  { section: "", icon: "lucide:square-kanban", labelKey: "board" },
  { section: "list", icon: "lucide:list", labelKey: "issues" },
  { section: "members", icon: "lucide:users", labelKey: "members" },
  {
    section: "settings",
    icon: "lucide:settings",
    labelKey: "settings",
    permission: PROJECT_SETTINGS_PERMISSIONS,
  },
];

/**
 * Die Startseite eines Projekts — `…/project/<slug>/overview`.
 *
 * Sie steht in keiner Seitenleiste, denn sie *ist* die Projektzeile: wer ein
 * Projekt anklickt, ohne einen Bereich zu meinen, landet hier. Ein zweiter
 * Eintrag darunter zeigte auf dieselbe Adresse wie die Zeile über ihm.
 *
 * Der Eintrag existiert trotzdem, weil ein offener Reiter und ein geteilter Link
 * einen Namen und ein Zeichen brauchen — dieselbe Rolle wie `ROLES_NAV` und
 * `ACCOUNT_NAV` eine Ebene höher.
 */
export const PROJECT_OVERVIEW_NAV: NavEntry = {
  section: "overview",
  icon: "lucide:layout-dashboard",
  labelKey: "overview",
};

/**
 * Alle Bereiche unter `…/project/<slug>/…` — die Liste, aus der die Reiterleiste
 * Namen und Zeichen einer beliebigen Projektadresse auflöst. Das Gegenstück zu
 * `WORKSPACE_SECTIONS` eine Ebene tiefer.
 */
export const PROJECT_SECTIONS: NavEntry[] = [
  PROJECT_OVERVIEW_NAV,
  ...PROJECT_NAV,
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
  {
    section: "roles",
    icon: "lucide:shield-check",
    labelKey: "roles",
    permission: "role.manage",
  },
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
  {
    section: "roles",
    icon: "lucide:shield-check",
    labelKey: "roles",
    permission: "role.manage",
  },
  {
    section: "members",
    icon: "lucide:users",
    labelKey: "members",
    permission: "member.view",
  },
];

/**
 * Die Bereiche der eigenen Einstellungen — `/<workspaceId>/account/<section>`,
 * leere Sektion = Allgemein.
 *
 * Dieselbe zweite Ebene wie beim Workspace und beim Projekt, nur gehört sie
 * niemandem außer dem, der sie öffnet. Die Reihenfolge folgt der Häufigkeit:
 * zuerst, wer man ist, dann wie es aussieht, dann was einen erreicht — und
 * zuletzt, womit man sich anmeldet. Rechte spielen hier keine Rolle: jeder sieht
 * genau seine eigenen Einstellungen, also ist auch keine Zeile je verborgen.
 */
export const ACCOUNT_SETTINGS_NAV: NavEntry[] = [
  { section: "", icon: "lucide:user", labelKey: "general" },
  { section: "appearance", icon: "lucide:palette", labelKey: "appearance" },
  { section: "notifications", icon: "lucide:bell", labelKey: "notifications" },
  { section: "security", icon: "lucide:shield-check", labelKey: "security" },
  { section: "connections", icon: "lucide:link", labelKey: "connections" },
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

/** Ein Bereich der eigenen Einstellungen. Leere Sektion = Allgemein. */
export function accountPath(workspaceId: string, section: string): string {
  const base = workspacePath(workspaceId, "account");
  return section ? `${base}/${section}` : base;
}

/**
 * Die drei Bereiche, in die sich die Einstellungen teilen: was für alle im
 * Workspace gilt, was für ein Projekt gilt, und was nur einen selbst betrifft.
 */
export type SettingsScopeKey = "workspace" | "project" | "account";

export interface SettingsScopeEntry {
  key: SettingsScopeKey;
  label: string;
  icon: string;
  /**
   * Wohin der Bereich führt. Fehlt die Adresse — kein Projekt im Kontext —,
   * fällt der Eintrag bei `visibleSettingsScope()` ganz heraus, statt ihn tot
   * anzuzeigen.
   */
  href?: string;
}

/** Wie `SettingsScopeEntry`, nur nach dem Filtern: die Adresse steht fest. */
export type VisibleSettingsScopeEntry = SettingsScopeEntry & { href: string };

/**
 * Die Ziele des Bereichsumschalters — jeweils die Allgemein-Seite des Bereichs.
 *
 * Bewusst hier und nicht in den drei Layouts: die Adressen sind dieselben, egal
 * aus welchem Bereich man umschaltet, und drei Kopien davon wären drei Orte, an
 * denen eine Route veralten kann. Beschriftungen kommen von außen herein, damit
 * diese Datei ohne i18n auskommt.
 */
export function settingsScopeItems({
  workspaceId,
  projectSlug,
  labels,
}: {
  workspaceId: string;
  /** Das Projekt, das der mittlere Bereich öffnet. Ohne eines bleibt er stumpf. */
  projectSlug?: string;
  labels: Record<SettingsScopeKey, string>;
}): SettingsScopeEntry[] {
  // Von innen nach außen: erst was nur einen selbst angeht, dann das Projekt,
  // zuletzt der ganze Workspace. Das ist zugleich die Reihenfolge, in der man
  // sie braucht — an den eigenen Einstellungen dreht jeder, am Workspace die
  // wenigsten.
  //
  // Die Zeichen sind dieselben, mit denen die Seitenleiste diese Dinge schon
  // meint (`GLOBAL_NAV`, `ACCOUNT_NAV`) — ein Bereich soll nicht davon abhängen,
  // durch welche Tür man ihn betritt.
  return [
    {
      key: "account",
      label: labels.account,
      icon: "lucide:circle-user",
      href: accountPath(workspaceId, ""),
    },
    {
      key: "project",
      label: labels.project,
      icon: "lucide:folders",
      href: projectSlug
        ? projectSettingsPath(workspaceId, projectSlug, "")
        : undefined,
    },
    {
      key: "workspace",
      label: labels.workspace,
      icon: "lucide:building-2",
      href: workspaceSettingsPath(workspaceId, ""),
    },
  ];
}

/**
 * Die Kandidaten aus `settingsScopeItems()` auf das, was wirklich zur Wahl
 * steht: "Persönlich" immer, "Projekt"/"Workspace" nur mit Adresse UND
 * Berechtigung (`WORKSPACE_SETTINGS_PERMISSIONS`/`PROJECT_SETTINGS_PERMISSIONS`,
 * je vom Layout aufgelöst — diese Funktion kennt selbst keine Rechte).
 *
 * Bleibt am Ende nur "Persönlich" übrig, hat der Umschalter nichts mehr zum
 * Umschalten — die Layouts lassen `SettingsHeader` dann ganz weg.
 */
export function visibleSettingsScope(
  items: SettingsScopeEntry[],
  allowed: { workspace: boolean; project: boolean },
): VisibleSettingsScopeEntry[] {
  return items.filter((item): item is VisibleSettingsScopeEntry => {
    if (!item.href) return false;
    if (item.key === "account") return true;
    return allowed[item.key];
  });
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
