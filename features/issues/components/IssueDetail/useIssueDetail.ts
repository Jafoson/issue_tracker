"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  addComment,
  deleteIssue,
  updateIssue,
} from "@/features/issues/actions";
import type { IssueEditorData, IssuePatch } from "@/features/issues/types";
import type { PMDoc } from "@/lib/richtext/types";
import type { IssueDetail } from "@/types";

interface UseIssueDetailOptions {
  /** Interne Id oder Referenz der Form „PREFIX-123“. */
  issueRef: string;
  data: IssueEditorData;
  /**
   * Vorgeladenes Issue. Die Vollseite hat es vom Server, das Panel kennt beim
   * Öffnen nur die Referenz aus der URL und lädt selbst nach.
   */
  initialIssue?: IssueDetail;
  /** Läuft, nachdem das Issue gelöscht wurde — Panel schließen, Seite verlassen. */
  onDeleted: () => void;
}

export interface IssueDetailState {
  /** `null`, solange geladen wird — oder wenn es die Referenz nicht gibt. */
  issue: IssueDetail | null;
  /** Geladen und nichts gefunden. Unterscheidet den Leer- vom Ladezustand. */
  isMissing: boolean;
  patch: (patch: IssuePatch) => void;
  comment: (body: PMDoc) => Promise<void>;
  remove: () => void;
  /**
   * Holt das Issue erneut — für Änderungen, die am Hook vorbei geschrieben
   * wurden (z. B. Anhänge: eigene Server Actions, kein `patch()`). Das Panel
   * hängt an keinem Server-Render, ein bloßes `router.refresh()` allein
   * berührt `fetched` unten nicht.
   */
  refresh: () => Promise<void>;
}

/**
 * Lädt das Issue zur Referenz und schreibt Änderungen zurück — die gemeinsame
 * Grundlage von Seitenpanel (`IssueDetail`) und Vollseite (`IssueDetailPage`).
 * Beide zeigen dasselbe Issue und ändern es auf dieselbe Weise; nur die Hülle
 * darum unterscheidet sich, und die gehört nicht hierher.
 *
 * Nach jeder Änderung wird zweimal aufgefrischt: das Issue selbst über die API
 * (das Panel hängt an keinem Server-Render) und die Route über `router.refresh`,
 * damit Liste oder Board darunter denselben Stand zeigen.
 */
export function useIssueDetail({
  issueRef,
  data,
  initialIssue,
  onDeleted,
}: UseIssueDetailOptions): IssueDetailState {
  const router = useRouter();
  const [fetched, setFetched] = useState<IssueDetail | null>(null);
  const [isMissing, setIsMissing] = useState(false);
  const [, startTransition] = useTransition();
  const issue = fetched ?? initialIssue ?? null;

  const endpoint = useCallback(
    (ref: string) =>
      `/api/issues/${encodeURIComponent(ref)}?ws=${encodeURIComponent(data.workspaceId)}`,
    [data.workspaceId],
  );

  const load = useCallback(
    async (ref: string) => {
      const response = await fetch(endpoint(ref));
      return response.ok
        ? ((await response.json()) as IssueDetail | null)
        : null;
    },
    [endpoint],
  );

  useEffect(() => {
    if (initialIssue) return;
    let active = true;
    setFetched(null);
    setIsMissing(false);
    load(issueRef).then((fresh) => {
      if (!active) return;
      setFetched(fresh);
      setIsMissing(!fresh);
    });
    return () => {
      active = false;
    };
  }, [issueRef, initialIssue, load]);

  const reload = useCallback(async () => {
    if (!issue) return;
    const fresh = await load(issue.id);
    if (fresh) setFetched(fresh);
    router.refresh();
  }, [issue, load, router]);

  const patch = (patch: IssuePatch) => {
    if (!issue) return;
    startTransition(async () => {
      await updateIssue(issue.id, patch);
      await reload();
    });
  };

  const comment = async (body: PMDoc) => {
    if (!issue) return;
    await addComment(issue.id, body, data.me.id);
    await reload();
  };

  const remove = () => {
    if (!issue) return;
    startTransition(async () => {
      await deleteIssue(issue.id);
      onDeleted();
      router.refresh();
    });
  };

  return { issue, isMissing, patch, comment, remove, refresh: reload };
}
