import { getMembers, getTeams, getProjects, getIssuesByProject } from "@/features/issues/queries";
import { Teams } from "@/features/admin/components/Teams/Teams";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const [members, teams, projects] = await Promise.all([
    getMembers(), getTeams(), getProjects(),
  ]);

  const allIssues = (
    await Promise.all(projects.map((p) => getIssuesByProject(p.id)))
  ).flat();

  return <Teams teams={teams} members={members} projects={projects} allIssues={allIssues} />;
}
