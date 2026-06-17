import { notFound } from "next/navigation";
import { getIssuesByProject, getProjects, toProjectSlug } from "@/features/issues/queries";
import { Board } from "@/features/issues/components/Board/Board";

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

  const projects = await getProjects(workspace);
  const project = projects.find((p) => toProjectSlug(p.name) === projectSlug);
  if (!project) notFound();

  const issues = await getIssuesByProject(project.id, filters);
  return <Board issues={issues} projectId={project.id} />;
}
