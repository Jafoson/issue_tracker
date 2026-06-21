import { notFound } from "next/navigation";
import { getIssuesByProject, getProjects } from "@/features/issues/queries";
import { ListView } from "@/features/issues/components/ListView/ListView";

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

  const projects = await getProjects(workspace);
  const project = projects.find((p) => p.slug === projectSlug);
  if (!project) notFound();

  const issues = await getIssuesByProject(project.id, filters);
  return <ListView issues={issues} projectId={project.id} />;
}
