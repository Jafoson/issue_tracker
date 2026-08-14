import { notFound, redirect } from "next/navigation";
import { IssuePeek } from "@/features/issues/components/IssuePeek/IssuePeek";
import { getIssueComposerData } from "@/features/issues/editor-data";
import { Inbox } from "@/features/notifications/components/Inbox/Inbox";
import { getNotifications } from "@/features/notifications/queries";
import type { NotificationFilter } from "@/features/notifications/types";
import { getWorkspaceStatuses } from "@/features/workspaces/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const FILTERS: NotificationFilter[] = ["all", "workspace", "project"];

export default async function InboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; workspace: string }>;
  searchParams: Promise<{ scope?: string }>;
}) {
  const { locale, workspace } = await params;
  const { scope } = await searchParams;
  setCurrentWorkspaceId(workspace);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const filter: NotificationFilter = FILTERS.includes(
    scope as NotificationFilter,
  )
    ? (scope as NotificationFilter)
    : "all";

  const [notifications, statuses, composer] = await Promise.all([
    getNotifications(workspace, filter),
    getWorkspaceStatuses(),
    getIssueComposerData(),
  ]);
  if (!composer) notFound();

  return (
    <>
      <Inbox
        notifications={notifications}
        workspaceId={workspace}
        filter={filter}
        statuses={statuses}
      />
      {/* Öffnet das angeklickte Issue als Seitenpanel (`?issue=` in der URL). */}
      <IssuePeek data={composer} />
    </>
  );
}
