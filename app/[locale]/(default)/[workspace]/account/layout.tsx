import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  SettingsNav,
  type SettingsNavItem,
} from "@/components/ui/layout/SettingsNav/SettingsNav";
import { getMyProfile } from "@/features/account/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { ACCOUNT_SETTINGS_NAV, accountPath } from "@/lib/nav";
import { fullName } from "@/lib/utils/string";
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

  const [t, profile] = await Promise.all([getTranslations(), getMyProfile()]);
  if (!profile) notFound();

  const items: SettingsNavItem[] = ACCOUNT_SETTINGS_NAV.map((entry) => ({
    href: accountPath(workspace, entry.section),
    label: t(`nav.${entry.labelKey}`),
    icon: entry.icon,
  }));

  return (
    <div className={styles.shell}>
      <SettingsNav
        subject={fullName(profile)}
        color={profile.color}
        title={t("nav.account")}
        items={items}
      />
      <div className={styles.panel}>{children}</div>
    </div>
  );
}
