import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { loadMoreProjectActivity } from "@/features/audit/actions";
import { AuditLog } from "@/features/audit/components/AuditLog/AuditLog";
import { getProjectActivity } from "@/features/audit/queries";
import { getWorkspaceProjects } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { getAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Die volle, ungefilterte Aktivität dieses Projekts — anders als die kompakte
 * Karte in der Übersicht (`ProjectProfileView`), die ohne `audit.view` nur
 * eigene Einträge zeigt. Hier gibt es keinen gefilterten Zwischenstand: wer
 * die Seite erreicht, hat die Berechtigung und sieht alles.
 */
export default async function ProjectActivityPage({
  params,
}: {
  params: Promise<{ workspace: string; projectSlug: string }>;
}) {
  const { workspace, projectSlug } = await params;
  setCurrentWorkspaceId(workspace);

  const projects = await getWorkspaceProjects();
  const project = projects.find((p) => p.slug === projectSlug);
  if (!project) notFound();

  const [t, access] = await Promise.all([
    getTranslations(),
    getAccess({ projectId: project.id }),
  ]);
  if (!access.has("audit.view")) notFound();

  const { entries, nextCursor } = await getProjectActivity(project.id);

  return (
    <AuditLog
      entries={entries}
      nextCursor={nextCursor}
      loadMore={loadMoreProjectActivity.bind(null, project.id)}
      title={t("nav.activity")}
      description={t("audit.desc")}
      workspaceSlug={workspace}
    />
  );
}
