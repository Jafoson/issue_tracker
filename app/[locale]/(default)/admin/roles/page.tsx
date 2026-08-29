import { getTranslations } from "next-intl/server";
import { RoleManager } from "@/features/roles/components/RoleManager/RoleManager";
import { RolesPage } from "@/features/roles/components/RolesPage/RolesPage";

export const dynamic = "force-dynamic";

/**
 * Platform-level roles. The surrounding layout already requires
 * `platform.access`; anyone wanting to change something here additionally
 * needs `role.manage` in the platform context. `getRoleManagerView` resolves
 * this and returns `canManage` — enforcement happens in
 * `features/roles/actions.ts`.
 */
export default async function AdminRolesPage() {
  const t = await getTranslations();

  return (
    <RolesPage
      sections={[
        {
          id: "platform",
          label: t("roles.globalTitle"),
          node: (
            <RoleManager
              target={{ scope: "PLATFORM" }}
              title={t("roles.globalTitle")}
              subtitle={t("roles.globalSubtitle")}
            />
          ),
        },
      ]}
    />
  );
}
