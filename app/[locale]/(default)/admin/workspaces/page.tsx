import { loadMoreWorkspaces } from "@/features/admin/actions";
import { PlatformWorkspaces } from "@/features/admin/components/PlatformWorkspaces/PlatformWorkspaces";
import { getAllWorkspaces } from "@/features/admin/queries";
import { getAccess, PLATFORM } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * The platform's tenants.
 *
 * Anyone allowed into the section may view them; touching them requires the
 * respective permission. Both flags go in as props, so the view doesn't
 * offer anything the server would reject afterward — it's still checked
 * again there regardless (`features/admin/actions.ts`).
 */
export default async function AdminWorkspacesPage() {
  const [{ rows: workspaces, nextCursor }, access] = await Promise.all([
    getAllWorkspaces(),
    getAccess(PLATFORM),
  ]);

  return (
    <PlatformWorkspaces
      workspaces={workspaces}
      canSuspend={access.has("workspace.suspend")}
      canDelete={access.has("workspace.delete")}
      nextCursor={nextCursor}
      loadMore={loadMoreWorkspaces}
    />
  );
}
