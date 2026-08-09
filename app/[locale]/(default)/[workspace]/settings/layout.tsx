import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  SettingsNav,
  type SettingsNavItem,
} from "@/components/ui/layout/SettingsNav/SettingsNav";
import { getCurrentWorkspace } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { WORKSPACE_SETTINGS_NAV, workspaceSettingsPath } from "@/lib/nav";
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

  const [t, current, access] = await Promise.all([
    getTranslations(),
    getCurrentWorkspace(),
    getAccess({ workspaceId: workspace }),
  ]);
  if (!current) notFound();

  // Rollen sind der einzige Bereich mit eigener Hürde: dort stehen die Regeln,
  // nach denen alles andere entschieden wird. Die übrigen bleiben auch ohne
  // Schreibrecht sichtbar — sie zeigen dann, was gilt, nur unveränderlich.
  const items: SettingsNavItem[] = WORKSPACE_SETTINGS_NAV.filter(
    (entry) => entry.section !== "roles" || access.has("role.manage"),
  ).map((entry) => ({
    href: workspaceSettingsPath(workspace, entry.section),
    label: t(`nav.${entry.labelKey}`),
    icon: entry.icon,
  }));

  return (
    <div className={styles.shell}>
      <SettingsNav
        subject={current.name}
        color={current.color}
        title={t("nav.settings")}
        items={items}
      />
      <div className={styles.panel}>{children}</div>
    </div>
  );
}
