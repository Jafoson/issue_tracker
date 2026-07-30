import { notFound } from "next/navigation";
import { Board } from "@/features/issues/components/Board/Board";
import { IssuePeek } from "@/features/issues/components/IssuePeek/IssuePeek";
import { Topbar } from "@/features/issues/components/Topbar/Topbar";
import { getIssueComposerData } from "@/features/issues/editor-data";
import { getIssuesByProject } from "@/features/issues/queries";
import {
  getWorkspaceProjects,
  getWorkspaceStatuses,
} from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; projectSlug: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { workspace, projectSlug } = await params;
  const filters = await searchParams;
  setCurrentWorkspaceId(workspace);

  const projects = await getWorkspaceProjects();
  const project = projects.find((p) => p.slug === projectSlug);
  if (!project) notFound();

  const [issues, statuses, composer] = await Promise.all([
    getIssuesByProject(project.id, filters),
    getWorkspaceStatuses(),
    getIssueComposerData(),
  ]);
  if (!composer) notFound();

  return (
    <>
      <Topbar count={issues.length} />
      <Board
        issues={issues}
        projectId={project.id}
        statuses={statuses}
        composer={composer}
      />
      {/* Öffnet das angeklickte Issue als Seitenpanel (`?issue=` in der URL). */}
      <IssuePeek data={composer} />
    </>
  );
}
