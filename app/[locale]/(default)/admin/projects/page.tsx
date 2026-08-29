import { loadMoreProjects } from "@/features/admin/actions";
import {
  type OwnerOption,
  PlatformProjects,
} from "@/features/admin/components/PlatformProjects/PlatformProjects";
import { getAllProjects, getAllUsers } from "@/features/admin/queries";
import { getAccess, PLATFORM } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Core data of all projects.
 *
 * The list of possible owners is only loaded if someone can actually
 * reassign at all — it's gated on `user.manage`, and without that permission
 * the query would be not just superfluous but a permissions violation.
 * Deactivated accounts aren't in it: `reassignProject` rejects them, and a
 * choice that produces an error message isn't a choice.
 */
export default async function AdminProjectsPage() {
  const access = await getAccess(PLATFORM);
  const canManage = access.has("project.metadata.manage");

  const [{ rows: projects, nextCursor }, { rows: users }] = await Promise.all([
    getAllProjects(),
    canManage && access.has("user.manage")
      ? getAllUsers()
      : { rows: [], nextCursor: null },
  ]);

  const owners: OwnerOption[] = users
    .filter((user) => user.deactivatedAt === null)
    .map((user) => ({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
    }));

  return (
    <PlatformProjects
      projects={projects}
      owners={owners}
      canManage={canManage}
      canBreakGlass={access.has("project.breakglass")}
      nextCursor={nextCursor}
      loadMore={loadMoreProjects}
    />
  );
}
