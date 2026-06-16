import { notFound } from "next/navigation";
import { getIssuesByProject, getProjects } from "@/features/issues/queries";
import { Board } from "@/features/issues/components/Board/Board";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; projectId: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { projectId } = await params;
  const filters = await searchParams;

  const [projects, issues] = await Promise.all([
    getProjects(),
    getIssuesByProject(projectId, filters),
  ]);

  const project = projects.find((p) => p.id === projectId);
  if (!project) notFound();

  return <Board issues={issues} projectId={projectId} />;
}
