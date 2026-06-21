import { notFound } from "next/navigation";
import { ListView } from "@/features/issues/components/ListView/ListView";
import { getIssuesByProject, getProjects } from "@/features/issues/queries";

export const dynamic = "force-dynamic";

export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; projectId: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { workspace, projectId } = await params;
  const filters = await searchParams;

  const [projects, issues] = await Promise.all([
    getProjects(workspace),
    getIssuesByProject(projectId, filters),
  ]);

  const project = projects.find((p) => p.id === projectId);
  if (!project) notFound();

  return <ListView issues={issues} projectId={projectId} />;
}
