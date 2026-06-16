import { getMembers, getTeams } from "@/features/issues/queries";
import { Members } from "@/features/admin/components/Members/Members";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const [members, teams] = await Promise.all([getMembers(), getTeams()]);
  return <Members members={members} teams={teams} />;
}
