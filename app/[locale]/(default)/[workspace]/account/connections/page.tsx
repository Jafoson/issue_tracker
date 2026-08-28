import { notFound } from "next/navigation";
import { enabledOAuthProviders } from "@/auth.config";
import { AccountConnections } from "@/features/account/components/AccountConnections/AccountConnections";
import { getMyConnections } from "@/features/account/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/** Konten fremder Anbieter, über die man sich anmelden kann. */
export default async function AccountConnectionsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  // Kein Anbieter eingerichtet → die Seite gibt es nicht, nicht nur den
  // Reiter dazu (der schon im Layout verschwindet, aber die Adresse bliebe
  // sonst erreichbar).
  if (enabledOAuthProviders.length === 0) notFound();

  const view = await getMyConnections();
  if (!view) notFound();

  return <AccountConnections {...view} />;
}
