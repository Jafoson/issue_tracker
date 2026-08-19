import type { Translator } from "@/i18n/types";
import {
  ACCOUNT_SETTINGS_NAV,
  ADMIN_NAV,
  findBySection,
  PROJECT_NAV,
  PROJECT_SECTIONS,
  PROJECT_SETTINGS_NAV,
  WORKSPACE_SECTIONS,
  WORKSPACE_SETTINGS_NAV,
} from "@/lib/nav";
import type { Project } from "@/types";

// Der Tab-Set ist global — Tabs verschiedener Bereiche liegen zusammen. Der
// Kontext einer URL wird deshalb aus der URL selbst abgeleitet, nicht von außen
// gereicht: das erste Pfad-Segment ist der Bereich ("admin" oder eine
// Workspace-ID), das zweite die Sektion ("my", "project", "members", …).
function segments(path: string): { root: string; section: string } {
  const parts = path.split("/");
  return { root: parts[1] ?? "", section: parts[2] ?? "" };
}

/**
 * Workspace ID a tab's path belongs to, or `null` for admin tabs (which carry
 * no workspace context). Lets each tab decide independently whether workspace
 * lookups (projects, …) apply to it, instead of assuming the currently active
 * workspace.
 */
export function workspaceIdFromPath(path: string): string | null {
  const { root } = segments(path);
  return root && root !== "admin" ? root : null;
}

/** Resolve the project a `/<workspace>/project/<slug>` path points at, if any. */
function projectFromPath(path: string, projects: Project[]): Project | null {
  const m = path.match(/^\/[^/]+\/project\/([^/]+)/);
  if (!m) return null;
  return projects.find((p) => p.slug === m[1]) ?? null;
}

/**
 * Sub-section of a project path — `""` for the board, `"list"`, `"members"`, …
 * Read from the path rather than matched against a list of known suffixes, so a
 * new entry in `PROJECT_SECTIONS` needs no change here.
 */
function projectSection(path: string): string {
  return path.split("/")[4] ?? "";
}

/**
 * Der Bereich innerhalb der Projekteinstellungen — `""` für Allgemein,
 * `"members"`, `"roles"`, `"labels"`. `null`, wenn der Pfad gar nicht in den
 * Einstellungen liegt.
 *
 * Ohne diese Unterscheidung hießen alle vier Reiter „Projekt (Einstellungen)"
 * und wären nebeneinander nicht auseinanderzuhalten.
 */
function projectSettingsSection(path: string): string | null {
  const parts = path.split("/");
  return parts[4] === "settings" ? (parts[5] ?? "") : null;
}

/**
 * Der Bereich innerhalb der Workspace-Einstellungen — `""` für Allgemein,
 * `"projects"`, `"labels"`, `"teams"`, … `null`, wenn der Pfad gar nicht dort
 * liegt. Dieselbe Unterscheidung wie beim Projekt, eine Ebene höher: ohne sie
 * hießen alle Bereiche „Einstellungen" und wären nebeneinander nicht
 * auseinanderzuhalten.
 */
function workspaceSettingsSection(path: string): string | null {
  const parts = path.split("/");
  if (parts[1] === "admin" || parts[2] !== "settings") return null;
  return parts[3] ?? "";
}

/**
 * Die Ansicht innerhalb der eigenen Aufgaben — `""` für das Board, `"list"` für
 * die Liste. `null`, wenn der Pfad gar nicht dort liegt. Dieselben zwei
 * Ansichten wie im Projekt, deshalb dieselbe Unterscheidung: sonst hießen beide
 * Reiter „Meine Aufgaben".
 */
function myIssuesSection(path: string): string | null {
  const parts = path.split("/");
  if (parts[1] === "admin" || parts[2] !== "my") return null;
  return parts[3] ?? "";
}

/**
 * Der Bereich innerhalb der eigenen Einstellungen — `""` für Allgemein,
 * `"appearance"`, `"security"`, … `null`, wenn der Pfad nicht dort liegt.
 * Dieselbe Unterscheidung wie bei Workspace und Projekt: ohne sie hießen alle
 * fünf Reiter „Konto".
 */
function accountSection(path: string): string | null {
  const parts = path.split("/");
  if (parts[1] === "admin" || parts[2] !== "account") return null;
  return parts[3] ?? "";
}

/** Human title for a tab path (no query string). */
export function tabTitle(
  path: string,
  projects: Project[],
  t: Translator,
): string {
  const { root, section } = segments(path);

  if (root === "admin") {
    const entry = findBySection(ADMIN_NAV, section);
    return entry ? t(`nav.${entry.labelKey}`) : "Orbit";
  }

  if (section === "project") {
    return projectFromPath(path, projects)?.name ?? t("nav.board");
  }

  const entry = findBySection(WORKSPACE_SECTIONS, section);
  return entry ? t(`nav.${entry.labelKey}`) : "Orbit";
}

/** Project color for a project tab path, else null. */
export function tabColor(path: string, projects: Project[]): string | null {
  return projectFromPath(path, projects)?.color ?? null;
}

/** Uploaded project avatar for a project tab path, else null. */
export function tabImage(path: string, projects: Project[]): string | null {
  return projectFromPath(path, projects)?.avatarUrl ?? null;
}

/** Iconify name for a tab path. */
export function tabIcon(path: string): string {
  const { root, section } = segments(path);

  if (root === "admin") {
    return findBySection(ADMIN_NAV, section)?.icon ?? "lucide:settings";
  }

  if (section === "project") {
    // Wie beim Titel: die Einstellungen haben eine zweite Ebene, und die trägt
    // ihr eigenes Icon. Ohne diesen Zweig bekämen alle vier das Zahnrad.
    const settingsSection = projectSettingsSection(path);
    if (settingsSection !== null) {
      return (
        findBySection(PROJECT_SETTINGS_NAV, settingsSection)?.icon ??
        "lucide:settings"
      );
    }

    return (
      findBySection(PROJECT_SECTIONS, projectSection(path))?.icon ??
      "lucide:layout-dashboard"
    );
  }

  // Die eigenen Aufgaben haben zwei Ansichten wie ein Projekt — die Liste trägt
  // deren Zeichen, das Board bleibt beim Zeichen des Bereichs.
  if (myIssuesSection(path) === "list") {
    return findBySection(PROJECT_NAV, "list")?.icon ?? "lucide:list";
  }

  // Dieselbe zweite Ebene, nur für die eigenen Einstellungen.
  const account = accountSection(path);
  if (account !== null) {
    return (
      findBySection(ACCOUNT_SETTINGS_NAV, account)?.icon ?? "lucide:circle-user"
    );
  }

  // Wie beim Projekt: die Einstellungen haben eine zweite Ebene, und die trägt
  // ihr eigenes Icon. Ohne diesen Zweig bekäme jeder Bereich das Zahnrad.
  const workspaceSection = workspaceSettingsSection(path);
  if (workspaceSection !== null) {
    return (
      findBySection(WORKSPACE_SETTINGS_NAV, workspaceSection)?.icon ??
      "lucide:settings"
    );
  }

  return (
    findBySection(WORKSPACE_SECTIONS, section)?.icon ??
    "lucide:layout-dashboard"
  );
}

export interface TabMeta {
  title: string;
  color: string | null;
  icon: string | null;
  image: string | null;
}

/**
 * Derive everything the TabBar renders from a tab's stored href.
 *
 * The href may carry a query string (filters/sort, e.g. `?status=todo`) which
 * is stripped before deriving title/color/icon. Sub-views of a project get a
 * `Projektname (Aufgaben)` suffix so they stay distinct from its board tab; the
 * icon is omitted when a project color dot is shown instead.
 */
export function tabMeta(
  href: string,
  projects: Project[],
  t: Translator,
): TabMeta {
  const path = href.split("?")[0];
  const color = tabColor(path, projects);
  const image = tabImage(path, projects);

  let title = tabTitle(path, projects, t);
  // Das Board ist die Hauptansicht und trägt den Projektnamen unverändert —
  // jede Unterseite sagt im Suffix, welche sie ist.
  const inProject = path.includes("/project/");
  const settingsSection = inProject ? projectSettingsSection(path) : null;

  if (settingsSection !== null) {
    // Die Einstellungen haben eine zweite Ebene. Ihr Kopf heißt im Reiter
    // „Einstellungen", die Bereiche darunter tragen ihren eigenen Namen —
    // „Mitglieder" sagt mehr als „Einstellungen" und ist ebenso eindeutig.
    const sub = findBySection(PROJECT_SETTINGS_NAV, settingsSection);
    const label =
      sub && sub.section ? t(`nav.${sub.labelKey}`) : t("nav.settings");
    title = `${title} (${label})`;
  } else if (inProject) {
    const entry = findBySection(PROJECT_SECTIONS, projectSection(path));
    if (entry?.section) title = `${title} (${t(`nav.${entry.labelKey}`)})`;
  } else {
    // Dieselbe Regel für den Workspace: der Kopf heißt „Einstellungen", die
    // Bereiche darunter tragen ihren eigenen Namen.
    const section = workspaceSettingsSection(path);
    const sub = section ? findBySection(WORKSPACE_SETTINGS_NAV, section) : null;
    if (sub) title = `${title} (${t(`nav.${sub.labelKey}`)})`;

    // Und noch einmal für die eigenen Aufgaben: das Board ist die Hauptansicht
    // und trägt den Namen unverändert, die Liste sagt es im Suffix.
    if (myIssuesSection(path) === "list")
      title = `${title} (${t("nav.issues")})`;

    // Und noch einmal für die eigenen Einstellungen.
    const account = accountSection(path);
    const accountSub = account
      ? findBySection(ACCOUNT_SETTINGS_NAV, account)
      : null;
    if (accountSub) title = `${title} (${t(`nav.${accountSub.labelKey}`)})`;
  }

  return {
    title,
    color,
    icon: color ? null : tabIcon(path),
    image,
  };
}
