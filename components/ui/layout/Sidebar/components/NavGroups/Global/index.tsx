import { useTranslations } from 'next-intl';
import TabList, { TabGroup } from '../components/TabList';

function NavGroupGlobal() {
 const t = useTranslations("nav");

  const tabs: TabGroup[] = [
    {
      href: "/my",
      icon: "lucide:user",
      label: t("myIssues"),
    },
    {
      href: "/projects",
      icon: "lucide:folders",
      label: t("projects"),
    },
    {
      href: "/workspaces",
      icon: "lucide:building-2",
      label: t("workspaces"),
    },
  ];

  return <TabList tabs={tabs} />;
}

export default NavGroupGlobal