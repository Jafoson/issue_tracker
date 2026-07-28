import { notFound } from "next/navigation";
import { Board } from "@/features/issues/components/Board/Board";
import { Topbar } from "@/features/issues/components/Topbar/Topbar";
import { getIssuesByProject } from "@/features/issues/queries";
import {
  getWorkspaceIssueTypes,
  getWorkspaceLabels,
  getWorkspaceMembers,
  getWorkspaceProjects,
  getWorkspaceStatuses,
} from "@/features/workspaces/queries";

export const dynamic = "force-dynamic";

export default async function BoardPage({
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

  const [issues, statuses, members, labels, issueTypes] = await Promise.all([
    getIssuesByProject(project.id, filters),
    getWorkspaceStatuses(),
    getWorkspaceMembers(),
    getWorkspaceLabels(),
    getWorkspaceIssueTypes(),
  ]);

  return (
    <>
      <Topbar count={issues.length} />
      <Board
        issues={issues}
        projectId={project.id}
        statuses={statuses}
        lookups={{ projects, members, labels, issueTypes }}
      />
    </>
  );
}
