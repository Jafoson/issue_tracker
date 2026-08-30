import { getTranslations } from "next-intl/server";
import { getCurrentWorkspace } from "@/features/workspaces/queries";
import { GLOBAL_NAV, workspacePath } from "@/lib/nav";
import TabList, { type TabGroup } from "../components/TabList";

async function NavGroupGlobal() {
  const t = await getTranslations("nav");
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  const tabs: TabGroup[] = GLOBAL_NAV.map((entry) => {
    const href = workspacePath(workspace.id, entry.section);
    return {
      href,
      icon: entry.icon,
      label: t(entry.labelKey),
      // "My tasks" has two views (board and list). Without the section
      // below, the entry would lose its active marking as soon as you
      // switch to the list.
      ...(entry.section === "my" ? { activeHref: `${href}/*` } : {}),
    };
  });

  return <TabList tabs={tabs} />;
}

export default NavGroupGlobal;
