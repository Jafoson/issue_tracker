import { getTranslations } from "next-intl/server";
import { ADMIN_NAV, adminPath } from "@/lib/nav";
import { getAccess, PLATFORM } from "@/lib/permissions";
import TabList, { type TabGroup } from "../components/TabList";

/**
 * Die Bereiche der Plattformverwaltung.
 *
 * Gefiltert nach dem, was die Plattform-Rolle hergibt: die Rollen dieser Ebene
 * sind verschieden geschnitten, und Support etwa verwaltet keine Konten. Der
 * Filter ist Höflichkeit, kein Schutz — die Abfragen dahinter prüfen selbst
 * (`features/admin/queries.ts`).
 */
async function NavGroupAdmin() {
  const t = await getTranslations("nav");
  const access = await getAccess(PLATFORM);

  const tabs: TabGroup[] = ADMIN_NAV.filter(
    (entry) => !entry.permission || access.has(entry.permission),
  ).map((entry) => ({
    href: adminPath(entry.section),
    icon: entry.icon,
    label: t(entry.labelKey),
  }));

  return <TabList tabs={tabs} />;
}

export default NavGroupAdmin;
