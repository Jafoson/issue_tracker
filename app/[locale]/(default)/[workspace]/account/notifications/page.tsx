import { AccountNotifications } from "@/features/account/components/AccountNotifications/AccountNotifications";
import { getMyPreferences } from "@/features/account/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * What you want to be notified about — and through which channel.
 *
 * Theme and density live in the same database row and therefore come along
 * here too; the page just forwards the toggles it actually displays.
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
