import { notFound, redirect } from "next/navigation";
import { Inbox } from "@/features/issues/components/Inbox/Inbox";
import { IssuePeek } from "@/features/issues/components/IssuePeek/IssuePeek";
import { getIssueComposerData } from "@/features/issues/editor-data";
import { getInboxIssues } from "@/features/issues/queries";
import {
  getMe,
  getWorkspaceMembers,
  getWorkspaceProjects,
  getWorkspaceStatuses,
} from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  params,
}: {
  params: Promise<{ locale: string; workspace: string }>;
}) {
  const { locale, workspace } = await params;
  setCurrentWorkspaceId(workspace);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const [issues, me, members, projects, statuses, composer] = await Promise.all(
    [
      getInboxIssues(session.userId, workspace),
      getMe(),
      getWorkspaceMembers(),
      getWorkspaceProjects(),
      getWorkspaceStatuses(),
      getIssueComposerData(),
    ],
  );
  if (!me || !composer) notFound();

  return (
    <>
      <Inbox
        issues={issues}
        me={me}
        members={members}
        projects={projects}
        statuses={statuses}
      />
      {/* Öffnet das angeklickte Issue als Seitenpanel (`?issue=` in der URL). */}
      <IssuePeek data={composer} />
    </>
  );
}
