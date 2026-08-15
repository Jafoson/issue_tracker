import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SettingsHeader } from "@/components/ui/layout/SettingsHeader/SettingsHeader";
import {
  SettingsNav,
  type SettingsNavItem,
  type SettingsNavSubject,
} from "@/components/ui/layout/SettingsNav/SettingsNav";
import {
  getCurrentWorkspace,
  getMyWorkspaces,
  getWorkspaceProjects,
} from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import {
  navEntryAllowed,
  settingsScopeItems,
  WORKSPACE_SETTINGS_NAV,
  workspaceSettingsPath,
} from "@/lib/nav";
import { getAccess } from "@/lib/permissions";
import styles from "./settings.module.scss";

export const dynamic = "force-dynamic";

/**
 * Rahmen der Workspace-Einstellungen: links die Bereiche, rechts der offene.
 *
 * Aufgebaut wie der Rahmen der Projekteinstellungen und aus denselben Gründen.
 * Das Layout hält nur die Navigation zusammen. Jede Unterseite lädt ihre Daten
 * selbst und prüft dabei erneut — ein Layout schützt keine Server Action, und
 * eine ausgeblendete Zeile in der Leiste ist keine Zugriffskontrolle. Was hier
 * fehlt, ist nur nicht angeboten; verweigert wird es in der Seite.
 */
export default async function WorkspaceSettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const [t, current, access, projects, myWorkspaces] = await Promise.all([
    getTranslations(),
    getCurrentWorkspace(),
    getAccess({ workspaceId: workspace }),
    // Nur für den Umschalter: von hier führt kein Projekt-Kontext weiter, also
    // öffnet „Projekt" das erste sichtbare (die Liste ist nach Namen sortiert).
    // Sieht man keines, bleibt der Knopf stumpf.
    getWorkspaceProjects(),
    // Für den Wechsler im Kopf der Leiste — dieselbe Liste, die auch der
    // Wechsler der Seitenleiste zeigt.
    getMyWorkspaces(),
  ]);
  if (!current) notFound();

  // Der Kopf wechselt den Workspace und bleibt dabei in den Einstellungen. Wer
  // dort kein Zutrittsrecht hat, sieht die Seite nicht — geprüft wird das in
  // `getWorkspaceSettingsView` je Unterseite, nicht an dieser Zeile.
  const siblings: SettingsNavSubject[] = myWorkspaces.map((ws) => ({
    id: ws.id,
    name: ws.name,
    color: ws.color,
    href: workspaceSettingsPath(ws.id, ""),
  }));

  const scope = settingsScopeItems({
    workspaceId: workspace,
    projectSlug: projects[0]?.slug,
    labels: {
      workspace: t("settings.scopeWorkspace"),
      project: t("settings.scopeProject"),
      account: t("settings.scopeAccount"),
    },
  });

  // Rollen und Mitglieder sind die einzigen Bereiche mit eigener Hürde
  // (`role.manage` bzw. `member.view`) — die übrigen bleiben auch ohne
  // Schreibrecht sichtbar, sie zeigen dann, was gilt, nur unveränderlich.
  const items: SettingsNavItem[] = WORKSPACE_SETTINGS_NAV.filter((entry) =>
    navEntryAllowed(access.has, entry),
  ).map((entry) => ({
    href: workspaceSettingsPath(workspace, entry.section),
    label: t(`nav.${entry.labelKey}`),
    icon: entry.icon,
  }));

  return (
    <div className={styles.shell}>
      <SettingsHeader
        items={scope}
        active="workspace"
        label={t("settings.scopeLabel")}
        unavailableHint={t("settings.scopeNoProject")}
      />
      <div className={styles.body}>
        <SettingsNav
          subject={current.name}
          color={current.color}
          siblings={siblings}
          siblingsLabel={t("settings.scopeWorkspace")}
          title={t("nav.settings")}
          items={items}
        />
        <div className={styles.panel}>{children}</div>
      </div>
    </div>
  );
}
