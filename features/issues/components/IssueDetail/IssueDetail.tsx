"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  addComment,
  deleteIssue,
  updateIssue,
} from "@/features/issues/actions";
import type { IssueComposerData, IssuePatch } from "@/features/issues/types";
import type { PMDoc } from "@/lib/richtext/types";
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
  /**
   * Schreibt die Optionen des umgebenden Modals fort. Nur gesetzt, wenn die
   * Ansicht in einem Modal steckt — die Vollseite hat keines.
   */
  onSetModalOptions?: (patch: {
    placement?: "center" | "right";
    centered?: boolean;
    width?: number | string;
  }) => void;
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
  onSetModalOptions,
}: IssueDetailProps) {
  const router = useRouter();
  /**
   * Ob die Ansicht als großer Dialog steht statt als Seitenpanel.
   *
   * Die Vollseite (`variant="page"`) kennt den Wechsel nicht — sie ist keine
   * Einblendung und hat kein Modal, dessen Platzierung sich ändern ließe.
   */
  const [isExpanded, setIsExpanded] = useState(false);
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

  /**
   * Klappt zwischen Seitenpanel und großem Dialog um.
   *
   * Platzierung und Breite gehören dem Modal, die Kopfzeile und der Zuschnitt
   * dem Inhalt — deshalb wandert beides zusammen.
   */
  const toggleExpanded = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    onSetModalOptions?.(
      next
        ? // Ohne `width`: die Breite steht als `--modal-w` am Modal selbst
          // (`.expanded` in `issueDetail.module.scss`). Die Option bemisst nur
          // die Hülle darum — stand dort ein anderer Wert, saß das schmalere
          // Modal an deren linker Kante und wirkte aus der Mitte gerückt.
          { placement: "center", centered: true, width: undefined }
        : { placement: "right", centered: false, width: undefined },
    );
  };

  const handleComment = async (body: PMDoc) => {
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
      onClose={onClose}
      variant={variant}
      onToggleExpanded={onSetModalOptions ? toggleExpanded : undefined}
      isExpanded={isExpanded}
      onPatch={handlePatch}
      onComment={handleComment}
      onDelete={handleDelete}
    />
  );
}
