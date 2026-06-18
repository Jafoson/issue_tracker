"use client";
import { Icon } from "@iconify/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useOptimistic, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { reorderIssue } from "@/features/issues/actions";
import { BoardCard } from "@/features/issues/components/BoardCard/BoardCard";
import { StatusIcon } from "@/features/issues/components/IssueIcons/IssueIcons";
import { useTranslations } from "@/lib/translations-context";
import { useWorkspace } from "@/lib/workspace-context";
import type { Issue } from "@/types";
import styles from "./board.module.scss";

interface BoardProps {
  issues: Issue[];
  projectId: string;
}

// rank=0 means "not yet ranked" — use created timestamp as effective rank
const erank = (i: Issue) => (i.rank !== 0 ? i.rank : i.created);

export function Board({ issues, projectId }: BoardProps) {
  const { statuses, projects } = useWorkspace();
  const t = useTranslations();
  const columnStatuses = statuses.filter((s) => s.isColumn);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  const sortedByRank = (list: Issue[]) =>
    [...list].sort((a, b) => erank(a) - erank(b));

  const openIssue = (issue: Issue) => {
    const prefix = projects.find((p) => p.id === issue.project)?.prefix ?? "?";
    const p = new URLSearchParams(searchParams.toString());
    p.set("issue", `${prefix}-${issue.key}`);
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const onDragStart = (e: React.DragEvent, issue: Issue) => {
    dragIssueRef.current = issue;
    setDragging(issue.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const onCardDragOver = (e: React.DragEvent, cardId: string) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const above = e.clientY < rect.top + rect.height / 2;
    dragOverCardRef.current = cardId;
    insertAboveRef.current = above;
    setDragOverCard(cardId);
    setInsertAbove(above);
  };

  const clearDragState = () => {
    dragIssueRef.current = null;
    dragOverCardRef.current = null;
    setDragging(null);
    setOverCol(null);
    setDragOverCard(null);
  };

  const onDrop = (e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    const issue = dragIssueRef.current;
    if (!issue) return;

    // Only use dragOverCard if it belongs to the target column
    const colIssues = sortedByRank(
      optimisticIssues.filter(
        (i) => i.status === statusId && i.id !== issue.id,
      ),
    );
    const overCardId = dragOverCardRef.current;
    const overIdx = overCardId
      ? colIssues.findIndex((i) => i.id === overCardId)
      : -1;

    let rank: number;
    if (overIdx !== -1) {
      const card = colIssues[overIdx];
      if (insertAboveRef.current) {
        const prev = colIssues[overIdx - 1];
        rank = prev ? (erank(prev) + erank(card)) / 2 : erank(card) - 1000;
      } else {
        const next = colIssues[overIdx + 1];
        rank = next ? (erank(card) + erank(next)) / 2 : erank(card) + 1000;
      }
    } else {
      const last = colIssues[colIssues.length - 1];
      rank = last ? erank(last) + 1000 : Date.now();
    }

    clearDragState();

    startTransition(async () => {
      addOptimistic({ id: issue.id, status: statusId, rank });
      await reorderIssue(issue.id, statusId, rank);
      router.refresh();
    });
  };

  return (
    <div className={styles.board}>
      {columnStatuses.map((s) => {
        const colIssues = sortedByRank(
          optimisticIssues.filter((i) => i.status === s.id),
        );
        const isOver = overCol === s.id;
        return (
          <div
            key={s.id}
            className={`orbit-col${isOver ? " drag-over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(s.id);
            }}
            onDrop={(e) => onDrop(e, s.id)}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setOverCol(null);
                setDragOverCard(null);
                dragOverCardRef.current = null;
              }
            }}
          >
            <div className={styles.colHeader}>
              <StatusIcon status={s.id} size={16} />
              <span className={styles.colTitle}>{s.name}</span>
              <Badge mono size="sm">
                {colIssues.length}
              </Badge>
              <button
                className="iconbtn"
                style={{ marginLeft: "auto" }}
                title={t.actions.newIssue}
                onClick={() =>
                  (
                    window as { __openComposer?: (status?: string) => void }
                  ).__openComposer?.(s.id)
                }
              >
                <Icon icon="lucide:plus" width={15} />
              </button>
            </div>

            <div className={styles.cards}>
              {colIssues.map((issue) => {
                const isCardOver =
                  dragOverCard === issue.id && dragging !== issue.id;
                return (
                  <React.Fragment key={issue.id}>
                    {isCardOver && insertAbove && (
                      <div className={styles.dropIndicator} />
                    )}
                    <BoardCard
                      issue={issue}
                      projectId={projectId}
                      isDragging={dragging === issue.id}
                      onDragStart={(e) => onDragStart(e, issue)}
                      onDragEnd={clearDragState}
                      onDragOver={(e) => onCardDragOver(e, issue.id)}
                      onClick={() => openIssue(issue)}
                    />
                    {isCardOver && !insertAbove && (
                      <div className={styles.dropIndicator} />
                    )}
                  </React.Fragment>
                );
              })}
              <button
                type="button"
                className={styles.addCard}
                title={t.actions.newIssue}
                onClick={() =>
                  (
                    window as { __openComposer?: (status?: string) => void }
                  ).__openComposer?.(s.id)
                }
              >
                <Icon icon="lucide:plus" width={15} />
                <span>{t.actions.newIssue}</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
