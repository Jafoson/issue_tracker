import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { IssuePeek } from "@/features/issues/components/IssuePeek/IssuePeek";
import { ListView } from "@/features/issues/components/ListView/ListView";
import { Topbar } from "@/features/issues/components/Topbar/Topbar";
import { getIssueComposerData } from "@/features/issues/editor-data";
import { getMyIssues } from "@/features/issues/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Dieselben eigenen Aufgaben als Liste — mit einer Spalte für das Projekt. */
export default async function MyListPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; workspace: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { locale, workspace } = await params;
  const filters = await searchParams;
  setCurrentWorkspaceId(workspace);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const [issues, composer, t] = await Promise.all([
    getMyIssues(session.userId, workspace, filters),
    getIssueComposerData(),
    getTranslations(),
  ]);
  if (!composer) notFound();

  return (
    <>
      <Topbar count={issues.length} />
      <ListView
        issues={issues}
        composer={composer}
        emptyTitle={t("empty.noAssignedIssues")}
      />
      {/* Öffnet das angeklickte Issue als Seitenpanel (`?issue=` in der URL). */}
      <IssuePeek data={composer} />
    </>
  );
}
