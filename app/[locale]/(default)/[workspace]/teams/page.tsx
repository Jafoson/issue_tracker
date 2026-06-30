import { Teams } from "@/features/admin/components/Teams/Teams";
import {
  getIssuesByProject,
  getMembers,
  getProjects,
  getTeams,
} from "@/features/issues/queries";

export const dynamic = "force-dynamic";

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const [members, teams, projects] = await Promise.all([
    getMembers(workspace),
    getTeams(workspace),
    getProjects(workspace),
  ]);
  const allIssues = (
    await Promise.all(projects.map((p) => getIssuesByProject(p.id)))
  ).flat();
  return (
    <Teams
      teams={teams}
      members={members}
      projects={projects}
      allIssues={allIssues}
    />
  );
}
