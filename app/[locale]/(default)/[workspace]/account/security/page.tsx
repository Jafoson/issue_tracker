import { notFound } from "next/navigation";
import { AccountSecurity } from "@/features/account/components/AccountSecurity/AccountSecurity";
import { getMySecurity } from "@/features/account/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { accountPath } from "@/lib/nav";

export const dynamic = "force-dynamic";

/** Passwort, Anmeldeadresse, Anmeldewege. */
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
      // Der Pfad kennt den Workspace, die Komponente nicht — sie bekommt ihn
      // fertig, wie überall in der App.
      connectionsHref={accountPath(workspace, "connections")}
    />
  );
}
