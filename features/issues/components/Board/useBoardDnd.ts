import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { reorderIssue } from "@/features/issues/actions";
import type { Issue } from "@/types";

// rank=0 means "not yet ranked" — use created timestamp as effective rank
const erank = (issue: Issue) => (issue.rank !== 0 ? issue.rank : issue.created);

const sortedByRank = (list: Issue[]) =>
  [...list].sort((a, b) => erank(a) - erank(b));

/**
 * Encapsulates board drag-and-drop: optimistic reordering across status
 * columns, rank calculation, and the transient hover/insert state needed
 * to render drop indicators.
 */
export function useBoardDnd(issues: Issue[]) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // State only for rendering the drop indicator
  const [dragging, setDragging] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [dragOverCard, setDragOverCard] = useState<string | null>(null);
  const [insertAbove, setInsertAbove] = useState(false);

  // Refs for use inside event handlers — always up-to-date, no stale closure
  const dragIssueRef = useRef<Issue | null>(null);
  const dragOverCardRef = useRef<string | null>(null);
  const insertAboveRef = useRef(false);

  const [optimisticIssues, addOptimistic] = useOptimistic(
    issues,
    (
      state,
      { id, status, rank }: { id: string; status: string; rank: number },
    ) => state.map((i) => (i.id === id ? { ...i, status, rank } : i)),
  );

  const getColumnIssues = (statusId: string) =>
    sortedByRank(optimisticIssues.filter((i) => i.status === statusId));

  const clearDragState = () => {
    dragIssueRef.current = null;
    dragOverCardRef.current = null;
    setDragging(null);
    setOverCol(null);
    setDragOverCard(null);
  };

  const onDragStart = (issue: Issue) => (e: React.DragEvent) => {
    dragIssueRef.current = issue;
    setDragging(issue.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const onCardDragOver = (cardId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const above = e.clientY < rect.top + rect.height / 2;
    dragOverCardRef.current = cardId;
    insertAboveRef.current = above;
    setDragOverCard(cardId);
    setInsertAbove(above);
  };

  // Rank the dropped issue between its new neighbors (or at the column edge)
  const dropRank = (statusId: string, draggedId: string) => {
    const colIssues = getColumnIssues(statusId).filter(
      (i) => i.id !== draggedId,
    );
    const overCardId = dragOverCardRef.current;
    const overIdx = overCardId
      ? colIssues.findIndex((i) => i.id === overCardId)
      : -1;

    if (overIdx === -1) {
      const last = colIssues[colIssues.length - 1];
      return last ? erank(last) + 1000 : Date.now();
    }

    const card = colIssues[overIdx];
    if (insertAboveRef.current) {
      const prev = colIssues[overIdx - 1];
      return prev ? (erank(prev) + erank(card)) / 2 : erank(card) - 1000;
    }
    const next = colIssues[overIdx + 1];
    return next ? (erank(card) + erank(next)) / 2 : erank(card) + 1000;
  };

  const columnHandlers = (statusId: string) => ({
    isOver: overCol === statusId,
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setOverCol(statusId);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setOverCol(null);
        setDragOverCard(null);
        dragOverCardRef.current = null;
      }
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const issue = dragIssueRef.current;
      if (!issue) return;

      const rank = dropRank(statusId, issue.id);
      clearDragState();

      startTransition(async () => {
        addOptimistic({ id: issue.id, status: statusId, rank });
        await reorderIssue(issue.id, statusId, rank);
        router.refresh();
      });
    },
  });

  return {
    getColumnIssues,
    dragging,
    dragOverCard,
    insertAbove,
    onDragStart,
    onDragEnd: clearDragState,
    onCardDragOver,
    columnHandlers,
  };
}
