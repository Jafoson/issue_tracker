import { getTranslations } from "next-intl/server";
import { getCurrentWorkspace } from "@/features/workspaces/queries";
import {
  WORKSPACE_DASHBOARD_NAV,
  WORKSPACE_OVERVIEW_NAV,
  workspacePath,
} from "@/lib/nav";
import styles from "../../../sidebar.module.scss";
import TabList, { type TabGroup } from "../components/TabList";

/**
 * "Overview" and "Dashboard" of the workspace — two separate nav links,
 * unlike the project, which lists both under one shared row. Right at the
 * top, before "My tasks": whoever opens the workspace should see how
 * things stand first, not have to search for it afterward.
 */
async function NavGroupWorkspaceDashboard() {
  const t = await getTranslations("nav");
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  const tabs: TabGroup[] = [
    WORKSPACE_OVERVIEW_NAV,
    WORKSPACE_DASHBOARD_NAV,
  ].map((entry) => ({
    href: workspacePath(workspace.id, entry.section),
    icon: entry.icon,
    label: t(entry.labelKey),
  }));

  return (
    <div className={styles.workspaceDashboardGroup}>
      <TabList tabs={tabs} />
    </div>
  );
}

export default NavGroupWorkspaceDashboard;
