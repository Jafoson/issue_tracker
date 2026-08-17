import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { loadMoreWorkspaceActivity } from "@/features/audit/actions";
import { AuditLog } from "@/features/audit/components/AuditLog/AuditLog";
import { getWorkspaceActivity } from "@/features/audit/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { getAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Die volle, ungefilterte Aktivität dieses Workspace — Gegenstück zu
 * `.../project/[projectSlug]/settings/activity`, eine Ebene höher.
 */
export default async function WorkspaceActivityPage({
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
  if (!access.has("audit.view")) notFound();

  const { entries, nextCursor } = await getWorkspaceActivity(workspace);

  return (
    <AuditLog
      entries={entries}
      nextCursor={nextCursor}
      loadMore={loadMoreWorkspaceActivity.bind(null, workspace)}
      title={t("nav.activity")}
      description={t("audit.desc")}
      workspaceSlug={workspace}
    />
  );
}
