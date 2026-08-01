"use client";

import type { IssueComposerData } from "@/features/issues/types";
import {
  IssueDetailMissing,
  IssueDetailSkeleton,
  IssueDetailView,
} from "./IssueDetailView";
import { useIssueDetail } from "./useIssueDetail";

interface IssueDetailProps {
  /** Interne Id oder Referenz der Form „PREFIX-123“. */
  issueRef: string;
  data: IssueComposerData;
  onClose: () => void;
  /**
   * Ob die Ansicht als großer Dialog steht statt als Seitenpanel.
   *
   * Gesteuert von außen, nicht hier: die Entscheidung überdauert das einzelne
   * Issue (`IssuePeek` merkt sie sich für die Sitzung), und das Panel drumherum
   * muss sich mit ihr zugleich umstellen — beides ginge nicht, wenn sie hier
   * drin läge.
   */
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

/**
 * Die Detailansicht als Seitenpanel über Liste, Board und Posteingang. Sie
 * kennt beim Öffnen nur die Referenz aus der URL — geladen wird hier
 * (`useIssueDetail`), dargestellt in `IssueDetailView`.
 *
 * Die Vollseite unter `/[workspace]/issue/[ref]` ist keine Variante davon,
 * sondern eine eigene Hülle (`IssueDetailPage`) über demselben Hook.
 */
export function IssueDetail({
  issueRef,
  data,
  onClose,
  isExpanded = false,
  onToggleExpanded,
}: IssueDetailProps) {
  const { issue, isMissing, patch, comment, remove } = useIssueDetail({
    issueRef,
    data,
    onDeleted: onClose,
  });

  if (!issue) {
    return isMissing ? (
      <IssueDetailMissing isExpanded={isExpanded} onClose={onClose} />
    ) : (
      <IssueDetailSkeleton isExpanded={isExpanded} onClose={onClose} />
    );
  }

  return (
    <IssueDetailView
      issue={issue}
      data={data}
      onClose={onClose}
      onToggleExpanded={onToggleExpanded}
      isExpanded={isExpanded}
      onPatch={patch}
      onComment={comment}
      onDelete={remove}
    />
  );
}
