import { notFound, redirect } from "next/navigation";
import { Inbox } from "@/features/issues/components/Inbox/Inbox";
import { getInboxIssues } from "@/features/issues/queries";
import {
  getMe,
  getWorkspaceMembers,
  getWorkspaceProjects,
  getWorkspaceStatuses,
} from "@/features/workspaces/queries";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  params,
}: {
  params: Promise<{ locale: string; workspace: string }>;
}) {
  const { locale, workspace } = await params;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const [issues, me, members, projects, statuses] = await Promise.all([
    getInboxIssues(session.userId, workspace),
    getMe(),
    getWorkspaceMembers(),
    getWorkspaceProjects(),
    getWorkspaceStatuses(),
  ]);
  if (!me) notFound();

  return (
    <Inbox
      issues={issues}
      me={me}
      members={members}
      projects={projects}
      statuses={statuses}
    />
  );
}
