import { notFound } from "next/navigation";
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

  const view = await getMyConnections();
  if (!view) notFound();

  return <AccountConnections {...view} />;
}
