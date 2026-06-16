import { notFound } from "next/navigation";
import { getIssuesByProject, getProjects } from "@/features/issues/queries";
import { ListView } from "@/features/issues/components/ListView/ListView";

export const dynamic = "force-dynamic";

export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
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

  return <ListView issues={issues} projectId={projectId} />;
}
