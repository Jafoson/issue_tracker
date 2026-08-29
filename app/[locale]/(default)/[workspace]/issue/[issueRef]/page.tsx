import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IssueDetailPage } from "@/features/issues/components/IssueDetail/IssueDetailPage";
import { getIssueComposerData } from "@/features/issues/editor-data";
import { getIssueByRef } from "@/features/issues/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

type IssuePageParams = {
  locale: string;
  workspace: string;
  issueRef: string;
};

/**
 * The tab carries the identifier and title — with a shared URL, you can
 * already tell from the tab what it's about. `getIssueByRef` is cached for
 * the request, so the page below doesn't fetch the same data a second time.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<IssuePageParams>;
}): Promise<Metadata> {
  const { workspace, issueRef } = await params;
  const issue = await getIssueByRef(workspace, issueRef);
  if (!issue) return { title: issueRef };
  return { title: `${issueRef.toUpperCase()} · ${issue.title}` };
}

export default async function IssuePage({
  params,
}: {
  params: Promise<IssuePageParams>;
}) {
  const { workspace, issueRef } = await params;
  setCurrentWorkspaceId(workspace);

  const [issue, data] = await Promise.all([
    getIssueByRef(workspace, issueRef),
    getIssueComposerData(),
  ]);
  if (!issue || !data) notFound();

  // Locale-free — this page navigates via next-intl (auto-prefixed).
  return <IssueDetailPage issue={issue} data={data} />;
}
