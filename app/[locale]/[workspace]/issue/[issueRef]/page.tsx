import { notFound } from "next/navigation";
import { IssueDetailPage } from "@/features/issues/components/IssueDetail/IssueDetailPage";
import { getIssueByRef } from "@/features/issues/queries";

export const dynamic = "force-dynamic";

export default async function IssuePage({
  params,
}: {
  params: Promise<{ locale: string; workspace: string; issueRef: string }>;
}) {
  const { workspace, issueRef } = await params;
  const issue = await getIssueByRef(workspace, issueRef);
  if (!issue) notFound();

  // Locale-frei – IssueDetailPage navigiert über next-intl (auto-Präfix).
  return <IssueDetailPage issue={issue} backHref={`/${workspace}`} />;
}
