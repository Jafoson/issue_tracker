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

/** Sidebar "Workspace" group — workspace administration. */
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

/** All sections that live directly under `/<workspaceId>/…` — used by the TabBar to resolve any workspace-scoped tab. */
export const WORKSPACE_SECTIONS: NavEntry[] = [
  ...GLOBAL_NAV,
  ...WORKSPACE_NAV,
  INBOX_NAV,
];

/** Sidebar "Admin" group — `/admin` (empty section = root) or `/admin/<section>`. */
export const ADMIN_NAV: NavEntry[] = [
  { section: "", icon: "lucide:settings", labelKey: "general" },
  { section: "members", icon: "lucide:users", labelKey: "members" },
  { section: "roles", icon: "lucide:shield-check", labelKey: "roles" },
];

/** Per-project sub-nav — `/<workspaceId>/project/<slug>` (empty section = board) or `/<workspaceId>/project/<slug>/<section>`. */
export const PROJECT_NAV: NavEntry[] = [
  { section: "", icon: "lucide:layout-dashboard", labelKey: "board" },
  { section: "list", icon: "lucide:list", labelKey: "issues" },
  { section: "members", icon: "lucide:users", labelKey: "members" },
  { section: "settings", icon: "lucide:settings", labelKey: "settings" },
];

export function workspacePath(workspaceId: string, section: string): string {
  return section ? `/${workspaceId}/${section}` : `/${workspaceId}`;
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

export function findBySection(
  entries: NavEntry[],
  section: string,
): NavEntry | undefined {
  return entries.find((e) => e.section === section);
}
