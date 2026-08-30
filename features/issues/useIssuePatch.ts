"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updateIssue } from "@/features/issues/actions";

/**
 * Writes a partial change to an issue and refreshes the view afterward.
 *
 * Every picker gets its own transition — whether in a list row or on a
 * board card: this keeps the rest interactive while one of them writes its
 * change out.
 */
export function useIssuePatch(issueId: string) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const patch = (data: Parameters<typeof updateIssue>[1]) =>
    startTransition(async () => {
      await updateIssue(issueId, data);
      router.refresh();
    });

  return { patch, isPending };
}
