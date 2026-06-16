import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/ui/layout/AppShell/AppShell";
import {
  getWorkspace, getProjects, getMembers, getLabels, getSearchIssues,
  getStatuses, getPriorities, getIssueTypes, getRoles,
} from "@/features/issues/queries";
import { getStaticMessages, hasLocale } from "@/lib/i18n";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; workspace: string }>;
}) {
  const { locale, workspace: workspaceId } = await params;
  if (!hasLocale(locale)) notFound();

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const ws = await getWorkspace(workspaceId);
  if (!ws) notFound();

  const [projects, members, labels, searchIssues, statuses, priorities, issueTypes, roles, messages] = await Promise.all([
    getProjects(workspaceId),
    getMembers(workspaceId),
    getLabels(workspaceId),
    getSearchIssues(workspaceId),
    getStatuses(workspaceId),
    getPriorities(workspaceId),
    getIssueTypes(workspaceId),
    getRoles(workspaceId),
    getStaticMessages(locale),
  ]);

  const me = members.find((m) => m.id === session.userId) ?? members.find((m) => m.role === "admin") ?? members[0];
  if (!me) redirect(`/${locale}/login`);

  return (
    <AppShell messages={messages} workspace={{ workspace: ws, me, members, projects, labels, statuses, priorities, issueTypes, roles, searchIssues }}>
      {children}
    </AppShell>
  );
}
