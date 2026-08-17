import { loadMoreProjects } from "@/features/admin/actions";
import {
  type OwnerOption,
  PlatformProjects,
} from "@/features/admin/components/PlatformProjects/PlatformProjects";
import { getAllProjects, getAllUsers } from "@/features/admin/queries";
import { getAccess, PLATFORM } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Die Stammdaten aller Projekte.
 *
 * Die Liste der möglichen Besitzer wird nur geladen, wenn jemand überhaupt
 * zuordnen darf — sie hängt an `user.manage`, und ohne die Berechtigung wäre die
 * Abfrage nicht nur überflüssig, sondern eine Rechteverletzung. Stillgelegte
 * Konten stehen nicht darin: `reassignProject` lehnt sie ab, und eine Auswahl,
 * die eine Fehlermeldung erzeugt, ist keine Auswahl.
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
