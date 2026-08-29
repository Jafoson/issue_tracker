import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { RoleManager } from "@/features/roles/components/RoleManager/RoleManager";
import { RolesPage } from "@/features/roles/components/RolesPage/RolesPage";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { getAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Roles that exist only within this one project.
 *
 * The workspace's project roles are deliberately not shown here — they
 * belong to the workspace and are maintained under its settings. Both
 * buckets are assignable together later (see `getProjectMembersView`).
 */
export default async function ProjectRolesPage({
  params,
}: {
  params: Promise<{ workspace: string; projectSlug: string }>;
}) {
  const { workspace, projectSlug } = await params;
  setCurrentWorkspaceId(workspace);

  const projects = await getWorkspaceProjects();
  const project = projects.find((p) => p.slug === projectSlug);
  if (!project) notFound();

  const [t, access] = await Promise.all([
    getTranslations(),
    getAccess({ projectId: project.id }),
  ]);
  if (!access.has("role.manage")) notFound();

  return (
    <RolesPage
      sections={[
        {
          id: "project",
          label: t("roles.projectTitle"),
          node: (
            <RoleManager
              target={{
                scope: "PROJECT",
                workspaceId: workspace,
                projectId: project.id,
              }}
              title={t("roles.projectTitle")}
              subtitle={t("roles.projectSubtitle", { project: project.name })}
            />
          ),
        },
      ]}
    />
  );
}
