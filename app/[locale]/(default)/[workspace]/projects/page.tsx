import { ProjectList } from "@/features/projects/components/ProjectList/ProjectList";
import { getProjectsWithStats } from "@/features/projects/queries";
import { getWorkspaceMembers } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string; workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const [projects, members] = await Promise.all([
    getProjectsWithStats(workspace),
    getWorkspaceMembers(),
  ]);
  // Locale-frei – ProjectList navigiert über next-intl (auto-Präfix).
  const base = `/${workspace}`;

  return (
    <ProjectList
      projects={projects}
      members={members}
      base={base}
      workspaceId={workspace}
    />
  );
}
