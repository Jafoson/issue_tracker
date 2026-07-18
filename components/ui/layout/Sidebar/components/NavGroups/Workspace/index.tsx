import { getTranslations } from "next-intl/server";
import { getCurrentWorkspace } from "@/features/workspaces/queries";
import TabList, { type TabGroup } from "../components/TabList";

async function NavGroupWorkspace() {
  const t = await getTranslations("nav");
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  const base = `/${workspace.id}`;

  const tabs: TabGroup[] = [
    {
      href: `${base}/members`,
      icon: "lucide:users",
      label: t("members"),
    },
    {
      href: `${base}/teams`,
      icon: "lucide:users-round",
      label: t("teams"),
    },
    {
      href: `${base}/settings`,
      icon: "lucide:settings",
      label: t("workspaceSettings"),
    },
  ];

  return <TabList tabs={tabs} />;
}

export default NavGroupWorkspace;
