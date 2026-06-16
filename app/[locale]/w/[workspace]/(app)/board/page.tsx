import { redirect } from "next/navigation";
import { getProjects } from "@/features/issues/queries";

export default async function BoardIndexPage({
  params,
}: {
  params: Promise<{ locale: string; workspace: string }>;
}) {
  const { locale, workspace } = await params;
  const projects = await getProjects();
  if (projects.length === 0) redirect(`/${locale}/w/${workspace}/members`);
  redirect(`/${locale}/w/${workspace}/board/${projects[0].id}`);
}
