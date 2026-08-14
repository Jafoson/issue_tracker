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
 * „Übersicht" und „Dashboard" des Workspace — zwei eigene Navlinks, anders als
 * beim Projekt, das beide unter einer gemeinsamen Zeile führt. Ganz oben, vor
 * „Meine Aufgaben": wer den Workspace öffnet, soll zuerst sehen, wie er
 * dasteht, nicht erst danach suchen müssen.
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
