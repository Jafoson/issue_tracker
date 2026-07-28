import { notFound } from "next/navigation";
import { Members } from "@/features/admin/components/Members/Members";
import { getMembers, getTeams } from "@/features/issues/queries";
import { getMe, getWorkspaceRoles } from "@/features/workspaces/queries";

export const dynamic = "force-dynamic";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const [members, teams, me, roles] = await Promise.all([
    getMembers(workspace),
    getTeams(workspace),
    getMe(),
    getWorkspaceRoles(),
  ]);
  if (!me) notFound();

  return <Members members={members} teams={teams} me={me} roles={roles} />;
}
