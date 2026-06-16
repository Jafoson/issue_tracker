import { AppShell } from "@/components/ui/layout/AppShell/AppShell";
import {
  getProjects, getMembers, getLabels, getSearchIssues,
  getStatuses, getPriorities, getIssueTypes, getRoles,
} from "@/features/issues/queries";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [projects, members, labels, searchIssues, statuses, priorities, issueTypes, roles] = await Promise.all([
    getProjects(),
    getMembers(),
    getLabels(),
    getSearchIssues(),
    getStatuses(),
    getPriorities(),
    getIssueTypes(),
    getRoles(),
  ]);

  const me = members.find((m) => m.role === "admin") ?? members[0];

  return (
    <AppShell workspace={{ me, members, projects, labels, statuses, priorities, issueTypes, roles, searchIssues }}>
      {children}
    </AppShell>
  );
}
