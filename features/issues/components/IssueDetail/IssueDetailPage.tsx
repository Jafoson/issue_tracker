"use client";

import { useRouter } from "next/navigation";
import { IssueDetail } from "./IssueDetail";
import type { Issue } from "@/types";

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
