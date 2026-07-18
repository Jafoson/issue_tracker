import { getTranslations } from "next-intl/server";
import {
  getCurrentWorkspace,
  getWorkspaceProjects,
} from "@/features/workspaces/queries";
import styles from "../../../sidebar.module.scss";
import TabList, { type TabGroup } from "../components/TabList";
import { AddProjectButton } from "./AddProjectButton";

export default async function NavGroupProjects() {
  const t = await getTranslations();
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  const projects = await getWorkspaceProjects();
  const base = `/${workspace.id}`;

  //TODO implement project dashboard tab is active
  const projectTabs: TabGroup[] = projects.map((p) => {
    const projPath = `${base}/project/${p.slug}`;
    return {
      href: `${projPath}/dashboard`,
      activeHref: `${projPath}/*`,
      label: p.name,
      color: p.color,
      group: [
        {
          href: projPath,
          label: "Board",
          icon: "lucide:layout-dashboard",
        },
        {
          href: `${projPath}/list`,
          label: "Issue",
          icon: "lucide:list",
        },
        {
          href: `${projPath}/members`,
          label: "Mitglieder",
          icon: "lucide:users",
        },
        {
          href: `/settings/project/${p.slug}`,
          label: "Settings",
          icon: "lucide:settings",
        },
      ],
    };
  });

  return (
    <>
      <div className={styles.titleWrapper}>
        <span>{t("settings.projects")}</span>
        <AddProjectButton workspaceId={workspace.id} />
      </div>
      <div className={styles.projectTabsWrapper}>
        <TabList tabs={projectTabs} />
      </div>
    </>
  );
}
