import { getMyPreferences } from "@/features/account/queries";
import { PlatformDashboard } from "@/features/admin/components/PlatformDashboard/PlatformDashboard";
import { getDashboard, getPlatformStats } from "@/features/admin/queries";
import { toRange } from "@/lib/buckets";
import { adminPath } from "@/lib/nav";
import { getAccess, PLATFORM } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * The platform dashboard.
 *
 * The time range comes from the URL rather than component state: that way it
 * can be shared, survives a reload, and the computation stays on the server.
 * An unknown value falls back to 30 days (`toRange`) — a URL is input like
 * any other.
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
    // The notice above is decided server-side, not in the browser: otherwise
    // it would appear in the first paint and then vanish again on hydration.
    getMyPreferences(),
  ]);

  // Same gating as the sidebar (`ADMIN_NAV`): a tile pointing at a section this
  // role isn't allowed to open would be an arrow into a 404. Support, for
  // instance, sees the numbers but doesn't manage accounts.
  return (
    <PlatformDashboard
      stats={stats}
      data={data}
      noticeHidden={preferences.adminNoticeHidden}
      links={{
        users: access.has("user.manage") ? adminPath("users") : undefined,
        // No dedicated permission for this — the list is open to anyone
        // allowed into the section (see `getAllWorkspaces`).
        workspaces: adminPath("workspaces"),
        projects: access.has("project.metadata.view")
          ? adminPath("projects")
          : undefined,
        audit: access.has("audit.view") ? adminPath("audit") : undefined,
      }}
    />
  );
}
