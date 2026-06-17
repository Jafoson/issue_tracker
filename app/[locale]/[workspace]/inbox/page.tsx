import { redirect } from "next/navigation";
import { getInboxIssues } from "@/features/issues/queries";
import { getSession } from "@/lib/session";
import { Inbox } from "@/features/issues/components/Inbox/Inbox";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  params,
}: {
  params: Promise<{ locale: string; workspace: string }>;
}) {
  const { locale, workspace } = await params;
  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const issues = await getInboxIssues(session.userId, workspace);
  return <Inbox issues={issues} />;
}
