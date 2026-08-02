"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updateIssue } from "@/features/issues/actions";

/**
 * Schreibt eine Teiländerung an einem Issue und holt die Ansicht danach neu.
 *
 * Jeder Picker bekommt seinen eigenen Übergang — ob in einer Listenzeile oder
 * auf einer Board-Karte: so bleibt der Rest bedienbar, während einer von ihnen
 * seine Änderung wegschreibt.
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
