import { notFound, redirect } from "next/navigation";
import { IssuePeek } from "@/features/issues/components/IssuePeek/IssuePeek";
import { MyIssues } from "@/features/issues/components/MyIssues/MyIssues";
import { getIssueComposerData } from "@/features/issues/editor-data";
import { getMyIssues } from "@/features/issues/queries";
import {
  getWorkspaceProjects,
  getWorkspaceStatuses,
} from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function MyPage({
  params,
}: {
  params: Promise<{ locale: string; workspace: string }>;
}) {
  const { locale, workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const [issues, projects, statuses, composer] = await Promise.all([
    getMyIssues(session.userId, workspace),
    getWorkspaceProjects(),
    getWorkspaceStatuses(),
    getIssueComposerData(),
  ]);
  if (!composer) notFound();

  return (
    <>
      <MyIssues issues={issues} projects={projects} statuses={statuses} />
      {/* Öffnet das angeklickte Issue als Seitenpanel (`?issue=` in der URL). */}
      <IssuePeek data={composer} />
    </>
  );
}
