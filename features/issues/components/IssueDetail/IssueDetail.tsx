"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  addComment,
  deleteIssue,
  updateIssue,
} from "@/features/issues/actions";
import type { IssueComposerData, IssuePatch } from "@/features/issues/types";
import type { Issue } from "@/types";
import {
  IssueDetailMissing,
  IssueDetailSkeleton,
  type IssueDetailVariant,
  IssueDetailView,
} from "./IssueDetailView";

interface IssueDetailProps {
  /** Interne Id oder Referenz der Form „PREFIX-123“. */
  issueRef: string;
  data: IssueComposerData;
  /**
   * Vorgeladenes Issue. Die Vollseite hat es vom Server, das Panel kennt beim
   * Öffnen nur die Referenz aus der URL und lädt selbst nach.
   */
  initialIssue?: Issue;
  variant?: IssueDetailVariant;
  onClose: () => void;
}

/**
 * Lädt das Issue zur Referenz und schreibt Änderungen zurück. Die Darstellung
 * macht `IssueDetailView`.
 *
 * Nach jeder Änderung wird zweimal aufgefrischt: das Issue selbst über die API
 * (das Panel hängt an keinem Server-Render) und die Route über `router.refresh`,
 * damit Liste oder Board darunter denselben Stand zeigen.
 */
export function IssueDetail({
  issueRef,
  data,
  initialIssue,
  variant = "panel",
  onClose,
}: IssueDetailProps) {
  const router = useRouter();
  const [fetched, setFetched] = useState<Issue | null>(null);
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
      return response.ok ? ((await response.json()) as Issue | null) : null;
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

  if (!issue) {
    return isMissing ? (
      <IssueDetailMissing variant={variant} onClose={onClose} />
    ) : (
      <IssueDetailSkeleton variant={variant} onClose={onClose} />
    );
  }

  const reload = async () => {
    const fresh = await load(issue.id);
    if (fresh) setFetched(fresh);
    router.refresh();
  };

  const handlePatch = (patch: IssuePatch) =>
    startTransition(async () => {
      await updateIssue(issue.id, patch);
      await reload();
    });

  const handleComment = async (body: string) => {
    await addComment(issue.id, body, data.me.id);
    await reload();
  };

  const handleDelete = () =>
    startTransition(async () => {
      await deleteIssue(issue.id);
      onClose();
      router.refresh();
    });

  return (
    <IssueDetailView
      issue={issue}
      data={data}
      variant={variant}
      onClose={onClose}
      onPatch={handlePatch}
      onComment={handleComment}
      onDelete={handleDelete}
    />
  );
}
