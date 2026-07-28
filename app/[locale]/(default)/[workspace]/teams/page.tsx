import { notFound } from "next/navigation";
import { Teams } from "@/features/admin/components/Teams/Teams";
import {
  getIssuesByProject,
  getMembers,
  getTeams,
} from "@/features/issues/queries";
import { getMe, getWorkspaceProjects } from "@/features/workspaces/queries";

export const dynamic = "force-dynamic";

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const [members, teams, projects, me] = await Promise.all([
    getMembers(workspace),
    getTeams(workspace),
    getWorkspaceProjects(),
    getMe(),
  ]);
  if (!me) notFound();

  const allIssues = (
    await Promise.all(projects.map((p) => getIssuesByProject(p.id)))
  ).flat();

  return (
    <Teams
      teams={teams}
      members={members}
      projects={projects}
      allIssues={allIssues}
      me={me}
    />
  );
}
