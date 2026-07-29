import { notFound } from "next/navigation";
import { IssueDetailPage } from "@/features/issues/components/IssueDetail/IssueDetailPage";
import { getIssueEditorData } from "@/features/issues/editor-data";
import { getIssueByRef } from "@/features/issues/queries";
import { setCurrentWorkspaceId } from "@/lib/current-workspace";

export const dynamic = "force-dynamic";

export default async function IssuePage({
  params,
}: {
  params: Promise<{ locale: string; workspace: string; issueRef: string }>;
}) {
  const { workspace, issueRef } = await params;
  setCurrentWorkspaceId(workspace);

  const [issue, data] = await Promise.all([
    getIssueByRef(workspace, issueRef),
    getIssueEditorData(),
  ]);
  if (!issue || !data) notFound();

  // Locale-frei – IssueDetailPage navigiert über next-intl (auto-Präfix).
  return (
    <IssueDetailPage issue={issue} backHref={`/${workspace}`} data={data} />
  );
}
