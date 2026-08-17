import { notFound } from "next/navigation";
import { loadMoreUsers } from "@/features/admin/actions";
import { PlatformUsers } from "@/features/admin/components/PlatformUsers/PlatformUsers";
import { getAllUsers, getPlatformRoles } from "@/features/admin/queries";
import { TABLE_PAGE_SIZE } from "@/lib/pagination";
import { currentUserId } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Die Benutzerverwaltung — `user.manage`, nicht bloß `platform.access`.
 *
 * Den Bereich zu betreten und Konten zu verwalten sind zwei verschiedene Dinge:
 * die Support-Rolle darf das erste und ausdrücklich nicht das zweite
 * (`lib/rbac/roles.ts`). `notFound` statt einer Fehlerseite, weil die
 * Seitenleiste den Eintrag für sie ohnehin nicht zeigt — eine Adresse, die man
 * nur durch Raten findet, soll auch nichts über sich verraten.
 */
export default async function AdminUsersPage() {
  const userId = await currentUserId();
  if (!userId) notFound();

  const [{ rows: users, nextCursor }, roles] = await Promise.all([
    getAllUsers(undefined, TABLE_PAGE_SIZE),
    getPlatformRoles(),
  ]);

  return (
    <PlatformUsers
      users={users}
      roles={roles}
      currentUserId={userId}
      nextCursor={nextCursor}
      loadMore={loadMoreUsers}
    />
  );
}
