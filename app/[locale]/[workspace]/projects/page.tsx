import { getMembers } from "@/features/issues/queries";
import { ProjectList } from "@/features/projects/components/ProjectList/ProjectList";
import { getProjectsWithStats } from "@/features/projects/queries";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string; workspace: string }>;
}) {
  const { locale, workspace } = await params;
  const [projects, members] = await Promise.all([
    getProjectsWithStats(workspace),
    getMembers(workspace),
  ]);
  const base = `/${locale}/${workspace}`;

  return (
    <ProjectList
      projects={projects}
      members={members}
      base={base}
      workspaceId={workspace}
    />
  );
}
