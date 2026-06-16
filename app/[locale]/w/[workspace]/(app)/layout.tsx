import { notFound } from "next/navigation";
import { AppShell } from "@/components/ui/layout/AppShell/AppShell";
import {
  getProjects, getMembers, getLabels, getSearchIssues,
  getStatuses, getPriorities, getIssueTypes, getRoles,
} from "@/features/issues/queries";
import { getStaticMessages, hasLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const [projects, members, labels, searchIssues, statuses, priorities, issueTypes, roles, messages] = await Promise.all([
    getProjects(),
    getMembers(),
    getLabels(),
    getSearchIssues(),
    getStatuses(),
    getPriorities(),
    getIssueTypes(),
    getRoles(),
    getStaticMessages(locale),
  ]);

  const me = members.find((m) => m.role === "admin") ?? members[0];

  return (
    <AppShell messages={messages} workspace={{ me, members, projects, labels, statuses, priorities, issueTypes, roles, searchIssues }}>
      {children}
    </AppShell>
  );
}
