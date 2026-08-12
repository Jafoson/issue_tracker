import { PlatformWorkspaces } from "@/features/admin/components/PlatformWorkspaces/PlatformWorkspaces";
import { getAllWorkspaces } from "@/features/admin/queries";
import { getAccess, PLATFORM } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Die Mandanten der Plattform.
 *
 * Sehen darf sie jeder, der den Bereich betreten darf; anfassen nur, wer das
 * jeweilige Recht trägt. Die beiden Flags gehen als Props hinein, damit die
 * Ansicht nichts anbietet, was der Server danach ablehnen würde — geprüft wird
 * trotzdem dort noch einmal (`features/admin/actions.ts`).
 */
export default async function AdminWorkspacesPage() {
  const [workspaces, access] = await Promise.all([
    getAllWorkspaces(),
    getAccess(PLATFORM),
  ]);

  return (
    <PlatformWorkspaces
      workspaces={workspaces}
      canSuspend={access.has("workspace.suspend")}
      canDelete={access.has("workspace.delete")}
    />
  );
}
