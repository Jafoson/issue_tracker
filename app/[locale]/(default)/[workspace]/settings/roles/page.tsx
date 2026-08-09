import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { RoleManager } from "@/features/roles/components/RoleManager/RoleManager";
import { RolesPage } from "@/features/roles/components/RolesPage/RolesPage";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { getAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Rollen des Workspace — zwei Töpfe auf einer Seite, hier im Rahmen der
 * Einstellungen.
 *
 * Oben die Workspace-Rollen selbst, darunter die Projektrollen, die in allen
 * Projekten dieses Workspace zuweisbar sind. Beide hängen an `role.manage` im
 * Workspace-Kontext: wer die Projektrollen des Workspace setzt, entscheidet über
 * alle seine Projekte auf einmal.
 */
export default async function WorkspaceSettingsRolesPage({
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
  // Ohne Einblick in die Rollen gibt es die Seite für diesen Benutzer nicht.
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
