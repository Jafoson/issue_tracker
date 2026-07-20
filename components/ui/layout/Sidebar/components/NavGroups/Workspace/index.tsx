import { getTranslations } from "next-intl/server";
import { getCurrentWorkspace } from "@/features/workspaces/queries";
import { WORKSPACE_NAV, workspacePath } from "@/lib/nav";
import TabList, { type TabGroup } from "../components/TabList";

async function NavGroupWorkspace() {
  const t = await getTranslations("nav");
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  const tabs: TabGroup[] = WORKSPACE_NAV.map((entry) => ({
    href: workspacePath(workspace.id, entry.section),
    icon: entry.icon,
    // The Sidebar spells out "Workspace Settings" here since it sits in a
    // list of workspace-level items; the TabBar tab just says "Settings"
    // (see PROJECT_NAV / tabMeta.ts, which use entry.labelKey directly).
    label:
      entry.section === "settings" ? t("workspaceSettings") : t(entry.labelKey),
  }));

  return <TabList tabs={tabs} />;
}

export default NavGroupWorkspace;
