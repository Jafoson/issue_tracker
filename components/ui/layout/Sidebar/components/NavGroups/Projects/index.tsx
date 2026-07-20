import { getTranslations } from "next-intl/server";
import {
  getCurrentWorkspace,
  getWorkspaceProjects,
} from "@/features/workspaces/queries";
import { PROJECT_NAV, projectPath } from "@/lib/nav";
import styles from "../../../sidebar.module.scss";
import TabList, { type TabGroup } from "../components/TabList";
import { AddProjectButton } from "./AddProjectButton";

export default async function NavGroupProjects() {
  const t = await getTranslations();
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  const projects = await getWorkspaceProjects();

  //TODO implement project dashboard tab is active
  const projectTabs: TabGroup[] = projects.map((p) => {
    const projPath = projectPath(workspace.id, p.slug, "");
    return {
      href: `${projPath}/dashboard`,
      activeHref: `${projPath}/*`,
      label: p.name,
      color: p.color,
      group: [
        ...PROJECT_NAV.map((entry) => ({
          href: projectPath(workspace.id, p.slug, entry.section),
          label: t(`nav.${entry.labelKey}`),
          icon: entry.icon,
        })),
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
