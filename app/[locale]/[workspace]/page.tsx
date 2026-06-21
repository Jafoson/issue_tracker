import { redirect } from "next/navigation";
import { getProjects } from "@/features/issues/queries";

export default async function WorkspaceRootPage({
  params,
}: {
  params: Promise<{ locale: string; workspace: string }>;
}) {
  const { locale, workspace } = await params;
  const projects = await getProjects(workspace);
  if (projects.length === 0) redirect(`/${locale}/${workspace}/members`);
  redirect(`/${locale}/${workspace}/project/${projects[0].slug}`);
}
