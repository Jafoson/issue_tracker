import { getTranslations } from "next-intl/server";
import { RoleManager } from "@/features/roles/components/RoleManager/RoleManager";

export const dynamic = "force-dynamic";

/**
 * Rollen der Plattform-Ebene. Das umgebende Layout verlangt bereits
 * `platform.access`; wer hier etwas ändern will, braucht zusätzlich
 * `role.manage` im Plattform-Kontext. `getRoleManagerView` löst das auf und
 * liefert `canManage` — geblockt wird in `features/roles/actions.ts`.
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
