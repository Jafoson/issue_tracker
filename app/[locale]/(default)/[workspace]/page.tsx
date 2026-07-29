import { redirect } from "next/navigation";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export default async function WorkspaceRootPage({
  params,
}: {
  params: Promise<{ locale: string; workspace: string }>;
}) {
  const { locale, workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const projects = await getWorkspaceProjects();
  if (projects.length === 0) redirect(`/${locale}/${workspace}/members`);
  redirect(`/${locale}/${workspace}/project/${projects[0].slug}`);
}
