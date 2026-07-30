"use client";

import type { IssueComposerData } from "@/features/issues/types";
import { useRouter } from "@/i18n/navigation";
import type { Issue } from "@/types";
import { IssueDetail } from "./IssueDetail";

interface Props {
  issue: Issue;
  backHref: string;
  data: IssueComposerData;
}

/** Vollseiten-Variante der Detailansicht unter `/[workspace]/issue/[ref]`. */
export function IssueDetailPage({ issue, backHref, data }: Props) {
  const router = useRouter();
  return (
    <IssueDetail
      issueRef={issue.id}
      initialIssue={issue}
      data={data}
      variant="page"
      onClose={() => router.push(backHref)}
    />
  );
}
