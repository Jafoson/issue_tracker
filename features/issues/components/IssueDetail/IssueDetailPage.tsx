"use client";

import type { IssueEditorData } from "@/features/issues/types";
import { useRouter } from "@/i18n/navigation";
import type { Issue } from "@/types";
import { IssueDetail } from "./IssueDetail";

interface Props {
  issue: Issue;
  backHref: string;
  data: IssueEditorData;
}

export function IssueDetailPage({ issue, backHref, data }: Props) {
  const router = useRouter();
  return (
    <IssueDetail
      id={issue.id}
      onClose={() => router.push(backHref)}
      initialIssue={issue}
      data={data}
      inline
    />
  );
}
