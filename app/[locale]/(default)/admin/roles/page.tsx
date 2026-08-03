import { getTranslations } from "next-intl/server";
import { RoleManager } from "@/features/roles/components/RoleManager/RoleManager";

export const dynamic = "force-dynamic";

/**
 * Rollen der globalen Ebene. Das umgebende Layout verlangt bereits
 * `platform.admin.access`; wer hier etwas ändern will, braucht zusätzlich
 * `platform.role.manage` — das prüft `getRoleManagerView`.
 */
export default async function AdminRolesPage() {
  const t = await getTranslations();

  return (
    <RoleManager
      target={{ scope: "PLATFORM" }}
      title={t("roles.globalTitle")}
      subtitle={t("roles.globalSubtitle")}
    />
  );
}
