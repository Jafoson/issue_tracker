import { getMembers, getTeams } from "@/features/issues/queries";
import { Members } from "@/features/admin/components/Members/Members";

export const dynamic = "force-dynamic";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const [members, teams] = await Promise.all([getMembers(workspace), getTeams(workspace)]);
  return <Members members={members} teams={teams} />;
}
