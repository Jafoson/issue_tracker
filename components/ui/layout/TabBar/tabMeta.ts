import type { Translator } from "@/i18n/types";
import {
  ADMIN_NAV,
  findBySection,
  PROJECT_NAV,
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

/** Resolve the project a `/<workspace>/project/<slug>` path points at, if any. */
function projectFromPath(path: string, projects: Project[]): Project | null {
  const m = path.match(/^\/[^/]+\/project\/([^/]+)/);
  if (!m) return null;
  return projects.find((p) => p.slug === m[1]) ?? null;
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
    const projectSection = path.endsWith("/list") ? "list" : "";
    return (
      findBySection(PROJECT_NAV, projectSection)?.icon ??
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
 * is stripped before deriving title/color/icon. The list ("Aufgaben") view of a
 * project gets a `Projektname (Aufgaben)` suffix so it's distinct from its board
 * tab; the icon is omitted when a project color dot is shown instead.
 */
export function tabMeta(
  href: string,
  projects: Project[],
  t: Translator,
): TabMeta {
  const path = href.split("?")[0];
  const color = tabColor(path, projects);

  let title = tabTitle(path, projects, t);
  if (path.includes("/project/") && path.endsWith("/list"))
    title = `${title} (${t("nav.issues")})`;

  return {
    title,
    color,
    icon: color ? null : tabIcon(path),
  };
}
