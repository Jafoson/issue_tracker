import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SettingsHeader } from "@/components/ui/layout/SettingsHeader/SettingsHeader";
import {
  SettingsNav,
  type SettingsNavItem,
} from "@/components/ui/layout/SettingsNav/SettingsNav";
import { getMyProfile } from "@/features/account/queries";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import {
  ACCOUNT_SETTINGS_NAV,
  accountPath,
  PROJECT_SETTINGS_PERMISSIONS,
  settingsScopeItems,
  visibleSettingsScope,
  WORKSPACE_SETTINGS_PERMISSIONS,
} from "@/lib/nav";
import { getAccess } from "@/lib/permissions";
import styles from "./account.module.scss";

export const dynamic = "force-dynamic";

/**
 * Rahmen der eigenen Einstellungen: links die Bereiche, rechts der offene.
 *
 * Aufgebaut wie der Rahmen der Workspace- und der Projekteinstellungen — es ist
 * dieselbe zweite Ebene, nur gehört sie keinem Workspace, sondern dem, der sie
 * öffnet. Deshalb steht oben in der Leiste der eigene Name und nicht der des
 * Workspace: die Seitenleiste daneben zeigt Workspaces und Projekte, und ohne
 * diese Zeile bliebe offen, wessen Einstellungen hier stehen.
 *
 * Gefiltert wird nichts. Rechte entscheiden hier über nichts — jeder sieht genau
 * sein eigenes Konto, und ein fremdes lässt sich über keine Adresse erreichen
 * (`features/account/queries.ts`).
 */
export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const [t, profile, projects, workspaceAccess] = await Promise.all([
    getTranslations(),
    getMyProfile(),
    // Nur für den Umschalter, siehe Workspace-Layout: „Projekt" öffnet das erste
    // sichtbare, und ohne eines (oder ohne Berechtigung darin) fällt das
    // Segment weg (`visibleSettingsScope`).
    getWorkspaceProjects(),
    getAccess({ workspaceId: workspace }),
  ]);
  if (!profile) notFound();

  const firstProject = projects[0];
  const projectAccess = firstProject
    ? await getAccess({ projectId: firstProject.id })
    : null;

  const scope = visibleSettingsScope(
    settingsScopeItems({
      workspaceId: workspace,
      projectSlug: firstProject?.slug,
      labels: {
        workspace: t("settings.scopeWorkspace"),
        project: t("settings.scopeProject"),
        account: t("settings.scopeAccount"),
      },
    }),
    {
      workspace: WORKSPACE_SETTINGS_PERMISSIONS.some(workspaceAccess.has),
      project: projectAccess
        ? PROJECT_SETTINGS_PERMISSIONS.some(projectAccess.has)
        : false,
    },
  );

  const items: SettingsNavItem[] = ACCOUNT_SETTINGS_NAV.map((entry) => ({
    href: accountPath(workspace, entry.section),
    label: t(`nav.${entry.labelKey}`),
    icon: entry.icon,
  }));

  return (
    <div className={styles.shell}>
      {/* Nur "Persönlich" übrig heißt: nichts zum Umschalten. */}
      {scope.length > 1 && (
        <SettingsHeader
          items={scope}
          active="account"
          label={t("settings.scopeLabel")}
        />
      )}
      <div className={styles.body}>
        <SettingsNav
          subject={t("nav.account")}
          title={t("nav.settings")}
          items={items}
        />
        <div className={styles.panel}>{children}</div>
      </div>
    </div>
  );
}
