import type { Translator } from "@/i18n/types";
import {
  ADMIN_NAV,
  findBySection,
  PROJECT_NAV,
  PROJECT_SETTINGS_NAV,
  WORKSPACE_SECTIONS,
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
 * new entry in `PROJECT_NAV` needs no change here.
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
      findBySection(PROJECT_NAV, projectSection(path))?.icon ??
      "lucide:layout-dashboard"
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
  } else {
    const entry = inProject
      ? findBySection(PROJECT_NAV, projectSection(path))
      : undefined;
    if (entry?.section) title = `${title} (${t(`nav.${entry.labelKey}`)})`;
  }

  return {
    title,
    color,
    icon: color ? null : tabIcon(path),
  };
}
