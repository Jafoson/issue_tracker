import { getMembers, getInboxIssues } from "@/features/issues/queries";
import { Inbox } from "@/features/issues/components/Inbox/Inbox";

export const dynamic = "force-dynamic";

export default async function InboxPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace } = await params;
  const members = await getMembers(workspace);
  const me = members.find((m) => m.role === "admin") ?? members[0];
  if (!me) return <Inbox issues={[]} />;
  const issues = await getInboxIssues(me.id, workspace);
  return <Inbox issues={issues} />;
}
