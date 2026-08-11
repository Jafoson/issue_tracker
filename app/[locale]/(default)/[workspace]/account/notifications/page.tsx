import { AccountNotifications } from "@/features/account/components/AccountNotifications/AccountNotifications";
import { getMyPreferences } from "@/features/account/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * Wovon man erfahren will — und auf welchem Weg.
 *
 * Design und Dichte liegen in derselben Zeile der Datenbank und kommen hier
 * deshalb mit; die Seite reicht nur die Schalter weiter, die sie zeigt.
 */
export default async function AccountNotificationsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const { theme: _theme, ...settings } = await getMyPreferences();

  return <AccountNotifications settings={settings} />;
}
