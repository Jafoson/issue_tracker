import { getTranslations } from "next-intl/server";
import { NewProjectButton } from "@/features/projects/components/NewProjectButton/NewProjectButton";
import {
  getCurrentWorkspace,
  getWorkspaceProjects,
} from "@/features/workspaces/queries";
import {
  navEntryAllowed,
  PROJECT_NAV,
  PROJECT_OVERVIEW_NAV,
  projectPath,
} from "@/lib/nav";
import { getAccess } from "@/lib/permissions";
import styles from "../../../sidebar.module.scss";
import TabList, { type TabGroup } from "../components/TabList";

export default async function NavGroupProjects() {
  const t = await getTranslations();
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  const [projects, access] = await Promise.all([
    getWorkspaceProjects(),
    getAccess({ workspaceId: workspace.id }),
  ]);

  // Je Projekt seine eigene Rolle — die Sichtbarkeit von "Einstellungen"
  // (`role.manage`/`label.create`/`project.update`) hängt an der Projektrolle,
  // nicht an der Workspace-Rolle darüber.
  const projectAccess = await Promise.all(
    projects.map((p) => getAccess({ projectId: p.id })),
  );

  // Die Projektzeile trägt `/*` und ist damit markiert, solange man irgendwo im
  // Projekt steht — ausgewertet wird das Muster in `lib/nav.ts` (`isNavActive`).
  const projectTabs: TabGroup[] = projects.map((p, i) => {
    const projPath = projectPath(workspace.id, p.slug, "");
    const pAccess = projectAccess[i];
    return {
      href: `${projPath}/${PROJECT_OVERVIEW_NAV.section}`,
      activeHref: `${projPath}/*`,
      label: p.name,
      color: p.color,
      image: p.avatarUrl ?? undefined,
      shape: "square",
      group: [
        ...PROJECT_NAV.filter((entry) =>
          navEntryAllowed(pAccess.has, entry),
        ).map((entry) => {
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
        {access.has("project.create") && (
          <NewProjectButton workspaceId={workspace.id} compact />
        )}
      </div>
      <div className={styles.projectTabsWrapper}>
        <TabList tabs={projectTabs} />
      </div>
    </>
  );
}
