import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  ProjectSettingsNav,
  type ProjectSettingsNavItem,
} from "@/features/projects/components/ProjectSettingsNav/ProjectSettingsNav";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { PROJECT_SETTINGS_NAV, projectSettingsPath } from "@/lib/nav";
import { getAccess } from "@/lib/permissions";
import styles from "./settings.module.scss";

export const dynamic = "force-dynamic";

/**
 * Rahmen der Projekteinstellungen: links die Bereiche, rechts der offene.
 *
 * Das Layout hält nur die Navigation zusammen. Jede Unterseite lädt ihre Daten
 * selbst und prüft dabei erneut — ein Layout schützt keine Server Action, und
 * eine ausgeblendete Zeile in der Leiste ist keine Zugriffskontrolle. Was hier
 * fehlt, ist nur nicht angeboten; verweigert wird es in der Seite.
 */
export default async function ProjectSettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string; projectSlug: string }>;
}) {
  const { workspace, projectSlug } = await params;
  setCurrentWorkspaceId(workspace);

  const projects = await getWorkspaceProjects();
  const project = projects.find((p) => p.slug === projectSlug);
  if (!project) notFound();

  const [t, access] = await Promise.all([
    getTranslations(),
    getAccess({ projectId: project.id }),
  ]);
  if (!access.has("project.view")) notFound();

  // Rollen sind der einzige Bereich mit eigener Hürde: dort stehen die Regeln,
  // nach denen alles andere entschieden wird. Allgemein und Labels bleiben auch
  // ohne Schreibrecht sichtbar — sie zeigen dann, was gilt, nur unveränderlich.
  const items: ProjectSettingsNavItem[] = PROJECT_SETTINGS_NAV.filter(
    (entry) => entry.section !== "roles" || access.has("role.manage"),
  ).map((entry) => ({
    href: projectSettingsPath(workspace, projectSlug, entry.section),
    label: t(`nav.${entry.labelKey}`),
    icon: entry.icon,
  }));

  return (
    <div className={styles.shell}>
      <ProjectSettingsNav
        projectName={project.name}
        projectColor={project.color}
        title={t("nav.settings")}
        items={items}
      />
      <div className={styles.panel}>{children}</div>
    </div>
  );
}
