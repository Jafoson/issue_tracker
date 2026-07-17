"use client"

import { useTranslations } from 'next-intl';
import TabList, { TabGroup } from '../components/TabList';
import { useWorkspace } from '@/lib/workspace-context';

function NavGroupWorkspace() {
 const t = useTranslations("nav");
 const { workspace } = useWorkspace();
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

export default NavGroupWorkspace