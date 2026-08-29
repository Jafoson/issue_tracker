import { notFound } from "next/navigation";
import { enabledOAuthProviders, passkeyLoginEnabled } from "@/auth.config";
import { AccountSecurity } from "@/features/account/components/AccountSecurity/AccountSecurity";
import { getMySecurity } from "@/features/account/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { accountPath } from "@/lib/nav";

export const dynamic = "force-dynamic";

/** Password, sign-in address, sign-in methods. */
export default async function AccountSecurityPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const view = await getMySecurity();
  if (!view) notFound();

  return (
    <AccountSecurity
      {...view}
      // The path knows the workspace, the component doesn't — it gets it
      // ready-made, as everywhere else in the app.
      connectionsHref={accountPath(workspace, "connections")}
      hasOAuthProviders={enabledOAuthProviders.length > 0}
      passkeyLoginEnabled={passkeyLoginEnabled}
    />
  );
}
