import { getTranslations } from "next-intl/server";
import { adminPath } from "@/lib/nav";
import { getAccess, PLATFORM } from "@/lib/permissions";
import TabList, { type TabGroup } from "../components/TabList";

/**
 * Der Weg in die Plattformverwaltung — der einzige.
 *
 * Er steht unten in der Seitenleiste des Workspace und nur für die, die
 * `platform.access` tragen. Für alle anderen gibt es ihn nicht: das Layout unter
 * `/admin` antwortet auf einen Aufruf ohne dieses Recht mit `notFound`, damit die
 * bloße Existenz des Bereichs nicht verrät, wer ihn öffnen darf. Ein sichtbarer
 * Eintrag, der ins Nichts führt, wäre genau diese Verrat-Lücke.
 *
 * Eigene Gruppe und nicht ein Eintrag mehr bei den Workspace-Zeilen: der Bereich
 * gehört keinem Workspace. Er steht über allen, und die Trennlinie sagt das.
 */
async function NavGroupPlatform() {
  const access = await getAccess(PLATFORM);
  if (!access.has("platform.access")) return null;

  const t = await getTranslations("nav");

  const tabs: TabGroup[] = [
    {
      href: adminPath(""),
      icon: "lucide:shield",
      label: t("admin"),
      // Auch aus den Unterseiten heraus markiert: der Sprung führt immer auf die
      // Übersicht, gemeint ist aber der ganze Bereich.
      activeHref: `${adminPath("")}/*`,
    },
  ];

  return <TabList tabs={tabs} />;
}

export default NavGroupPlatform;
