import { redirect } from "next/navigation";
import { projectSettingsPath } from "@/lib/nav";

export const dynamic = "force-dynamic";

/** Like `../members`: a project's roles now live under `settings`. */
export default async function ProjectRolesRedirect({
  params,
}: {
  params: Promise<{ locale: string; workspace: string; projectSlug: string }>;
}) {
  const { locale, workspace, projectSlug } = await params;
  redirect(`/${locale}${projectSettingsPath(workspace, projectSlug, "roles")}`);
}
