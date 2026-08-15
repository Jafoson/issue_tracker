import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SettingsHeader } from "@/components/ui/layout/SettingsHeader/SettingsHeader";
import {
  SettingsNav,
  type SettingsNavItem,
  type SettingsNavSubject,
} from "@/components/ui/layout/SettingsNav/SettingsNav";
import {
  getMyProjects,
  getWorkspaceProjects,
} from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import {
  navEntryAllowed,
  PROJECT_SETTINGS_NAV,
  PROJECT_SETTINGS_PERMISSIONS,
  projectSettingsPath,
  settingsScopeItems,
  visibleSettingsScope,
  WORKSPACE_SETTINGS_PERMISSIONS,
} from "@/lib/nav";
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

  const [t, access, workspaceAccess] = await Promise.all([
    getTranslations(),
    getAccess({ projectId: project.id }),
    getAccess({ workspaceId: workspace }),
  ]);
  if (!access.has("project.view")) notFound();

  // Hier ist das Projekt bekannt — der Umschalter führt zurück auf genau das,
  // in dem man gerade steht, und nicht auf ein beliebiges anderes.
  const scope = visibleSettingsScope(
    settingsScopeItems({
      workspaceId: workspace,
      projectSlug,
      labels: {
        workspace: t("settings.scopeWorkspace"),
        project: t("settings.scopeProject"),
        account: t("settings.scopeAccount"),
      },
    }),
    {
      workspace: WORKSPACE_SETTINGS_PERMISSIONS.some(workspaceAccess.has),
      project: PROJECT_SETTINGS_PERMISSIONS.some(access.has),
    },
  );

  // Der Kopf der Leiste wechselt das Projekt und bleibt dabei in den
  // Einstellungen — über Workspace-Grenzen hinweg, denn ein Projekt sucht man
  // nach seinem Namen und nicht danach, wo es hängt. `getMyProjects` liefert
  // genau die mit `project.view`, also dieselbe Hürde, die dieses Layout
  // gleich prüft: was hier steht, öffnet sich auch.
  const siblings: SettingsNavSubject[] = (await getMyProjects()).map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    href: projectSettingsPath(p.workspaceId, p.slug, ""),
    group: p.workspaceName,
  }));

  // Rollen sind der einzige Bereich mit eigener Hürde: dort stehen die Regeln,
  // nach denen alles andere entschieden wird. Allgemein und Labels bleiben auch
  // ohne Schreibrecht sichtbar — sie zeigen dann, was gilt, nur unveränderlich.
  const items: SettingsNavItem[] = PROJECT_SETTINGS_NAV.filter((entry) =>
    navEntryAllowed(access.has, entry),
  ).map((entry) => ({
    href: projectSettingsPath(workspace, projectSlug, entry.section),
    label: t(`nav.${entry.labelKey}`),
    icon: entry.icon,
  }));

  return (
    <div className={styles.shell}>
      {/* Nur "Persönlich" übrig heißt: nichts zum Umschalten. */}
      {scope.length > 1 && (
        <SettingsHeader
          items={scope}
          active="project"
          label={t("settings.scopeLabel")}
        />
      )}
      <div className={styles.body}>
        <SettingsNav
          subject={project.name}
          color={project.color}
          siblings={siblings}
          siblingsLabel={t("settings.scopeProject")}
          title={t("nav.settings")}
          items={items}
        />
        <div className={styles.panel}>{children}</div>
      </div>
    </div>
  );
}
