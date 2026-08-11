import { notFound } from "next/navigation";
import { AccountGeneral } from "@/features/account/components/AccountGeneral/AccountGeneral";
import { getMyProfile } from "@/features/account/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * Name, Benutzername, Farbe — und die Adresse, unter der man sich anmeldet.
 *
 * Wie überall lädt die Seite ihre Daten selbst. `null` heißt „nicht
 * eingeloggt"; das Layout darüber schützt sie nicht, es zeichnet nur die Leiste.
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
