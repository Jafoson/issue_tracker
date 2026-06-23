import { PlatformMembers } from "@/features/admin/components/PlatformMembers/PlatformMembers";
import { getAllUsers } from "@/features/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const users = await getAllUsers();
  return <PlatformMembers users={users} />;
}
