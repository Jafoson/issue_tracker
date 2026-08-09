import { getTranslations } from "next-intl/server";
import { NewProjectButton } from "@/features/projects/components/NewProjectButton/NewProjectButton";
import {
  getCurrentWorkspace,
  getWorkspaceProjects,
} from "@/features/workspaces/queries";
import { PROJECT_NAV, projectPath } from "@/lib/nav";
import styles from "../../../sidebar.module.scss";
import TabList, { type TabGroup } from "../components/TabList";

export default async function NavGroupProjects() {
  const t = await getTranslations();
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  const projects = await getWorkspaceProjects();

  // Die Projektzeile trägt `/*` und ist damit markiert, solange man irgendwo im
  // Projekt steht — ausgewertet wird das Muster in `lib/nav.ts` (`isNavActive`).
  const projectTabs: TabGroup[] = projects.map((p) => {
    const projPath = projectPath(workspace.id, p.slug, "");
    return {
      href: `${projPath}/dashboard`,
      activeHref: `${projPath}/*`,
      label: p.name,
      color: p.color,
      group: [
        ...PROJECT_NAV.map((entry) => {
          const href = projectPath(workspace.id, p.slug, entry.section);
          return {
            href,
            label: t(`nav.${entry.labelKey}`),
            icon: entry.icon,
            // Die Einstellungen haben eine zweite Ebene (Rollen, Labels). Ohne
            // den Bereich darunter verlöre der Eintrag seine Markierung, sobald
            // man dort etwas anklickt — und der Zweig klappte zu.
            ...(entry.section === "settings"
              ? { activeHref: `${href}/*` }
              : {}),
          };
        }),
      ],
    };
  });

  return (
    <>
      <div className={styles.titleWrapper}>
        <span>{t("settings.projects")}</span>
        <NewProjectButton workspaceId={workspace.id} compact />
      </div>
      <div className={styles.projectTabsWrapper}>
        <TabList tabs={projectTabs} />
      </div>
    </>
  );
}
