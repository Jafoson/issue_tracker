import { getMyPreferences } from "@/features/account/queries";
import { PlatformDashboard } from "@/features/admin/components/PlatformDashboard/PlatformDashboard";
import { getDashboard, getPlatformStats } from "@/features/admin/queries";
import { toRange } from "@/lib/buckets";
import { adminPath } from "@/lib/nav";
import { getAccess, PLATFORM } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Das Dashboard der Plattform.
 *
 * Der Zeitraum kommt aus der Adresse und nicht aus dem Zustand der Komponente:
 * so lässt er sich verschicken, überlebt das Neuladen, und die Auswertung bleibt
 * auf dem Server. Ein unbekannter Wert fällt auf 30 Tage zurück (`toRange`) —
 * eine Adresszeile ist Eingabe wie jede andere.
 */
export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: requested } = await searchParams;
  const range = toRange(requested);

  const [stats, data, access, preferences] = await Promise.all([
    getPlatformStats(),
    getDashboard(range),
    getAccess(PLATFORM),
    // Der Hinweis oben wird server-seitig entschieden, nicht im Browser: sonst
    // stünde er im ersten Bild und verschwände beim Hydrieren wieder.
    getMyPreferences(),
  ]);

  // Dieselbe Auswahl wie in der Seitenleiste (`ADMIN_NAV`): eine Kachel, die
  // auf einen Bereich zeigt, den diese Rolle nicht öffnen darf, wäre ein Pfeil
  // in eine 404. Support etwa sieht die Zahlen, verwaltet aber keine Konten.
  return (
    <PlatformDashboard
      stats={stats}
      data={data}
      noticeHidden={preferences.adminNoticeHidden}
      links={{
        users: access.has("user.manage") ? adminPath("users") : undefined,
        // Ohne eigenes Recht — die Liste steht jedem offen, der den Bereich
        // betreten darf (siehe `getAllWorkspaces`).
        workspaces: adminPath("workspaces"),
        projects: access.has("project.metadata.view")
          ? adminPath("projects")
          : undefined,
        audit: access.has("audit.view") ? adminPath("audit") : undefined,
      }}
    />
  );
}
