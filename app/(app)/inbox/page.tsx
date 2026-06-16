import { getMembers, getInboxIssues } from "@/features/issues/queries";
import { Inbox } from "@/features/issues/components/Inbox/Inbox";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const members = await getMembers();
  const me = members.find((m) => m.role === "admin") ?? members[0];
  if (!me) return <Inbox issues={[]} />;
  const issues = await getInboxIssues(me.id);
  return <Inbox issues={issues} />;
}
