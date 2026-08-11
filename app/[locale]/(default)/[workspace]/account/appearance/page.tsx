import { AccountAppearance } from "@/features/account/components/AccountAppearance/AccountAppearance";
import { getMyPreferences } from "@/features/account/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/** Design, Dichte, Sprache. */
export default async function AccountAppearancePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const preferences = await getMyPreferences();

  return (
    <AccountAppearance
      theme={preferences.theme}
      density={preferences.density}
    />
  );
}
