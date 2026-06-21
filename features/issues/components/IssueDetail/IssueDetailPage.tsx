"use client";

import { useRouter } from "next/navigation";
import type { Issue } from "@/types";
import { IssueDetail } from "./IssueDetail";

interface Props {
  issue: Issue;
  backHref: string;
}

export function IssueDetailPage({ issue, backHref }: Props) {
  const router = useRouter();
  return (
    <IssueDetail
      id={issue.id}
      onClose={() => router.push(backHref)}
      initialIssue={issue}
      inline
    />
  );
}
