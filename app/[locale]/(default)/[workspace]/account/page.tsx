import { notFound } from "next/navigation";
import { AccountGeneral } from "@/features/account/components/AccountGeneral/AccountGeneral";
import { getMyProfile } from "@/features/account/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * Name, username, color — and the address you sign in with.
 *
 * As everywhere, the page loads its own data. `null` means "not signed in";
 * the layout above it doesn't protect this page, it only draws the sidebar.
 */
export default async function AccountPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const profile = await getMyProfile();
  if (!profile) notFound();

  return <AccountGeneral profile={profile} />;
}
