import type { Translator } from "@/i18n/types";
import type { Project } from "@/types";

/** Resolve the project a `/project/<slug>` path points at, if any. */
function projectFromPath(
  path: string,
  projects: Project[],
  base: string,
): Project | null {
  const m = path.match(new RegExp(`^${base}/project/([^/]+)`));
  if (!m) return null;
  return projects.find((p) => p.slug === m[1]) ?? null;
}

/** Human title for a tab path (no query string). */
export function tabTitle(
  path: string,
  projects: Project[],
  t: Translator,
  base: string,
): string {
  if (path.match(new RegExp(`^${base}/project/([^/]+)`)))
    return projectFromPath(path, projects, base)?.name ?? t("nav.board");
  if (path.startsWith(`${base}/my`)) return t("nav.myIssues");
  if (path.startsWith(`${base}/inbox`)) return t("nav.inbox");
  if (path.startsWith(`${base}/members`)) return t("nav.members");
  if (path.startsWith(`${base}/teams`)) return t("nav.teams");
  if (path.startsWith(`${base}/settings`)) return t("nav.settings");
  if (path.startsWith(`${base}/projects`)) return t("nav.projects");
  return "Orbit";
}

/** Project color for a project tab path, else null. */
export function tabColor(
  path: string,
  projects: Project[],
  base: string,
): string | null {
  return projectFromPath(path, projects, base)?.color ?? null;
}

/** Iconify name for a tab path. */
export function tabIcon(path: string, base: string): string {
  if (path.includes("/project/") && path.endsWith("/list"))
    return "lucide:list";
  if (path.includes("/project/")) return "lucide:layout-dashboard";
  if (path.startsWith(`${base}/my`)) return "lucide:user";
  if (path.startsWith(`${base}/inbox`)) return "lucide:inbox";
  if (path.startsWith(`${base}/members`)) return "lucide:users";
  if (path.startsWith(`${base}/teams`)) return "lucide:users-2";
  if (path.startsWith(`${base}/settings`)) return "lucide:settings";
  if (path.startsWith(`${base}/projects`)) return "lucide:folders";
  return "lucide:layout-dashboard";
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
  base: string,
): TabMeta {
  const path = href.split("?")[0];
  const color = tabColor(path, projects, base);

  let title = tabTitle(path, projects, t, base);
  if (path.includes("/project/") && path.endsWith("/list"))
    title = `${title} (${t("nav.issues")})`;

  return {
    title,
    color,
    icon: color ? null : tabIcon(path, base),
  };
}
