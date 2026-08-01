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
 * Der Tab trägt Kennung und Titel — bei einer geteilten Adresse sieht man so
 * schon am Tab, worum es geht. `getIssueByRef` ist request-weit gecacht, die
 * Seite darunter holt dieselben Daten also nicht ein zweites Mal.
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

  // Locale-frei — die Seite navigiert über next-intl (auto-Präfix).
  return <IssueDetailPage issue={issue} data={data} />;
}
