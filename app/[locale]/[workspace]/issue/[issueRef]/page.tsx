import { notFound } from "next/navigation";
import { getIssueByRef } from "@/features/issues/queries";
import { IssueDetailPage } from "@/features/issues/components/IssueDetail/IssueDetailPage";

export const dynamic = "force-dynamic";

export default async function IssuePage({
  params,
}: {
  params: Promise<{ locale: string; workspace: string; issueRef: string }>;
}) {
  const { locale, workspace, issueRef } = await params;
  const issue = await getIssueByRef(workspace, issueRef);
  if (!issue) notFound();

  return <IssueDetailPage issue={issue} backHref={`/${locale}/${workspace}`} />;
}
