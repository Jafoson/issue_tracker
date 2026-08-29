import { notFound } from "next/navigation";
import { loadMoreUsers } from "@/features/admin/actions";
import { PlatformUsers } from "@/features/admin/components/PlatformUsers/PlatformUsers";
import { getAllUsers, getPlatformRoles } from "@/features/admin/queries";
import { TABLE_PAGE_SIZE } from "@/lib/pagination";
import { currentUserId } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * User management — `user.manage`, not just `platform.access`.
 *
 * Entering the section and managing accounts are two different things: the
 * support role is allowed the former and explicitly not the latter
 * (`lib/rbac/roles.ts`). `notFound` instead of an error page, because the
 * sidebar doesn't show this entry for them anyway — a URL you can only find
 * by guessing shouldn't reveal anything about itself either.
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
