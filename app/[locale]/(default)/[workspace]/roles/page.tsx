import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { RoleManager } from "@/features/roles/components/RoleManager/RoleManager";
import { RolesPage } from "@/features/roles/components/RolesPage/RolesPage";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { getAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Workspace roles — two buckets on one page.
 *
 * The workspace roles themselves on top, below them the project roles
 * assignable across all projects in this workspace. Both are gated on
 * `role.manage` in the workspace context: whoever sets the workspace's
 * project roles decides for all of its projects at once.
 */
export default async function WorkspaceRolesPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const [t, access] = await Promise.all([
    getTranslations(),
    getAccess({ workspaceId: workspace }),
  ]);
  // Without insight into the roles, this page doesn't exist for this user.
  if (!access.has("role.manage")) notFound();

  return (
    <RolesPage
      sections={[
        {
          id: "workspace",
          label: t("roles.workspaceTitle"),
          node: (
            <RoleManager
              showTitle={false}
              target={{ scope: "WORKSPACE", workspaceId: workspace }}
              title={t("roles.workspaceTitle")}
              subtitle={t("roles.workspaceSubtitle")}
            />
          ),
        },
        {
          id: "project",
          label: t("roles.workspaceProjectTitle"),
          node: (
            <RoleManager
              showTitle={false}
              target={{
                scope: "PROJECT",
                workspaceId: workspace,
                projectId: null,
              }}
              title={t("roles.workspaceProjectTitle")}
              subtitle={t("roles.workspaceProjectSubtitle")}
            />
          ),
        },
      ]}
    />
  );
}
