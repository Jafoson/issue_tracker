import { notFound } from "next/navigation";
import { enabledOAuthProviders } from "@/auth.config";
import { AccountConnections } from "@/features/account/components/AccountConnections/AccountConnections";
import { getMyConnections } from "@/features/account/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/** Third-party accounts you can sign in with. */
export default async function AccountConnectionsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  // No provider configured → the page doesn't exist, not just its tab (which
  // already disappears in the layout, but the URL would otherwise still be
  // reachable).
  if (enabledOAuthProviders.length === 0) notFound();

  const view = await getMyConnections();
  if (!view) notFound();

  return <AccountConnections {...view} />;
}
