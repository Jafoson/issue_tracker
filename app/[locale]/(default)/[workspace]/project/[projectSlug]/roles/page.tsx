import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { RoleManager } from "@/features/roles/components/RoleManager/RoleManager";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { getAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Rollen, die nur in diesem einen Projekt existieren.
 *
 * Die Projektrollen des Workspace stehen hier bewusst nicht — die gehören dem
 * Workspace und werden unter dessen Einstellungen gepflegt. Zuweisbar sind
 * später beide Töpfe zusammen (siehe `getProjectMembersView`).
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
    <RoleManager
      target={{
        scope: "PROJECT",
        workspaceId: workspace,
        projectId: project.id,
      }}
      title={t("roles.projectTitle")}
      subtitle={t("roles.projectSubtitle", { project: project.name })}
    />
  );
}
