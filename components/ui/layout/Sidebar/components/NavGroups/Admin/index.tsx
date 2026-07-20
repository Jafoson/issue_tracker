import { useTranslations } from "next-intl";
import { ADMIN_NAV, adminPath } from "@/lib/nav";
import TabList, { type TabGroup } from "../components/TabList";

function NavGroupAdmin() {
  const t = useTranslations("nav");

  const tabs: TabGroup[] = ADMIN_NAV.map((entry) => ({
    href: adminPath(entry.section),
    icon: entry.icon,
    label: t(entry.labelKey),
  }));

  return <TabList tabs={tabs} />;
}

export default NavGroupAdmin;
