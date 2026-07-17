import { useTranslations } from 'next-intl';
import TabList, { TabGroup } from '../components/TabList';

function NavGroupAdmin() {
 const t = useTranslations("nav");

  const tabs: TabGroup[] = [
    {
      href: "/admin",
      icon: "lucide:settings",
      label: t("general"),
    },
    {
      href: "/admin/members",
      icon: "lucide:users",
      label: t("members"),
    },
    {
      href: "/admin/roles",
      icon: "lucide:shield-check",
      label: t("roles"),
    },
  ];

  return <TabList tabs={tabs} />;
}

export default NavGroupAdmin