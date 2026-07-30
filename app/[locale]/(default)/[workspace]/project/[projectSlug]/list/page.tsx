import { notFound } from "next/navigation";
import { IssuePeek } from "@/features/issues/components/IssuePeek/IssuePeek";
import { ListView } from "@/features/issues/components/ListView/ListView";
import { Topbar } from "@/features/issues/components/Topbar/Topbar";
import { getIssueComposerData } from "@/features/issues/editor-data";
import { getIssuesByProject } from "@/features/issues/queries";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

export default async function ListPage({
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

  const [issues, composer] = await Promise.all([
    getIssuesByProject(project.id, filters),
    getIssueComposerData(),
  ]);
  if (!composer) notFound();

  return (
    <>
      <Topbar count={issues.length} />
      <ListView issues={issues} projectId={project.id} composer={composer} />
      {/* Öffnet das angeklickte Issue als Seitenpanel (`?issue=` in der URL). */}
      <IssuePeek data={composer} />
    </>
  );
}
