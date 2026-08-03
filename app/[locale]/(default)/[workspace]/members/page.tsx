import { notFound } from "next/navigation";
import { Members } from "@/features/admin/components/Members/Members";
import { getMembers, getTeams } from "@/features/issues/queries";
import { getMe, getWorkspaceRoles } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { getAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const [members, teams, me, roles, access] = await Promise.all([
    getMembers(workspace),
    getTeams(workspace),
    getMe(),
    getWorkspaceRoles(),
    getAccess({ workspaceId: workspace }),
  ]);
  if (!me) notFound();

  return (
    <Members
      members={members}
      teams={teams}
      me={me}
      roles={roles}
      can={{
        invite: access.has("member.invite"),
        setRole: access.has("member.role.update"),
        remove: access.has("member.remove"),
      }}
    />
  );
}
