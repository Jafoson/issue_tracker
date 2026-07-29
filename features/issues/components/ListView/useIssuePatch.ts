"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updateIssue } from "@/features/issues/actions";

/**
 * Schreibt eine Teiländerung an einem Issue und holt die Liste danach neu.
 *
 * Jede Zelle bekommt ihren eigenen Übergang: so bleibt der Rest der Zeile
 * bedienbar, während ein Picker seine Änderung wegschreibt.
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
