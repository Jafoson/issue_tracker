import { notFound } from "next/navigation";
import { WorkspacePreferences } from "@/features/workspaces/components/WorkspacePreferences/WorkspacePreferences";
import { getMe } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

/**
 * Design, Sprache und das eigene Konto.
 *
 * Der einzige Bereich der Einstellungen, der nicht dem Workspace gehört,
 * sondern dem Benutzer — er steht hier, weil man ihn hier sucht, und am Ende
 * der Leiste, weil alles darüber für alle gilt.
 */
export default async function WorkspacePreferencesPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const me = await getMe();
  if (!me) notFound();

  return <WorkspacePreferences me={me} />;
}
