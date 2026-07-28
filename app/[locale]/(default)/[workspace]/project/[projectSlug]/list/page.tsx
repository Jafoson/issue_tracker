import { notFound } from "next/navigation";
import { ListView } from "@/features/issues/components/ListView/ListView";
import { Topbar } from "@/features/issues/components/Topbar/Topbar";
import { getIssuesByProject } from "@/features/issues/queries";
import {
  getWorkspaceLabels,
  getWorkspaceMembers,
  getWorkspacePriorities,
  getWorkspaceProjects,
  getWorkspaceStatuses,
} from "@/features/workspaces/queries";

export const dynamic = "force-dynamic";

export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectSlug: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { projectSlug } = await params;
  const filters = await searchParams;

  const projects = await getWorkspaceProjects();
  const project = projects.find((p) => p.slug === projectSlug);
  if (!project) notFound();

  const [issues, members, labels, statuses, priorities] = await Promise.all([
    getIssuesByProject(project.id, filters),
    getWorkspaceMembers(),
    getWorkspaceLabels(),
    getWorkspaceStatuses(),
    getWorkspacePriorities(),
  ]);

  return (
    <>
      <Topbar count={issues.length} />
      <ListView
        issues={issues}
        projectId={project.id}
        lookups={{ projects, members, labels, statuses, priorities }}
      />
    </>
  );
}
