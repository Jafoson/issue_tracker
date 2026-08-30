import { getTranslations } from "next-intl/server";
import { getCurrentWorkspace } from "@/features/workspaces/queries";
import { navEntryAllowed, WORKSPACE_NAV, workspacePath } from "@/lib/nav";
import { getAccess } from "@/lib/permissions";
import TabList, { type TabGroup } from "../components/TabList";

/**
 * Filtered by what the workspace role grants — the same courtesy as in
 * `NavGroupAdmin`: no entry that leads to a 404 when clicked. The actual
 * check sits in the queries behind it (`getWorkspaceMembersView`,
 * `getWorkspaceSettingsView`, …).
 */
async function NavGroupWorkspace() {
  const t = await getTranslations("nav");
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  const access = await getAccess({ workspaceId: workspace.id });

  const tabs: TabGroup[] = WORKSPACE_NAV.filter((entry) =>
    navEntryAllowed(access.has, entry),
  ).map((entry) => {
    const href = workspacePath(workspace.id, entry.section);
    return {
      href,
      icon: entry.icon,
      // The Sidebar spells out "Workspace Settings" here since it sits in a
      // list of workspace-level items; the TabBar tab just says "Settings"
      // (see PROJECT_NAV / tabMeta.ts, which use entry.labelKey directly).
      label:
        entry.section === "settings"
          ? t("workspaceSettings")
          : t(entry.labelKey),
      // Settings has a second level (projects, labels, teams, roles …).
      // Without the section below, the entry would lose its active marking
      // as soon as something in it is clicked.
      ...(entry.section === "settings" ? { activeHref: `${href}/*` } : {}),
    };
  });

  return <TabList tabs={tabs} />;
}

export default NavGroupWorkspace;
