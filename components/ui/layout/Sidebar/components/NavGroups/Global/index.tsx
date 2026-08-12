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
      // „Meine Aufgaben" haben zwei Ansichten (Board und Liste). Ohne den
      // Bereich darunter verlöre der Eintrag seine Markierung, sobald man auf
      // die Liste umschaltet.
      ...(entry.section === "my" ? { activeHref: `${href}/*` } : {}),
    };
  });

  return <TabList tabs={tabs} />;
}

export default NavGroupGlobal;
