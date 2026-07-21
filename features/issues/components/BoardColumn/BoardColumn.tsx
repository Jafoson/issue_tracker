"use client";
import { Icon } from "@iconify/react";
import React from "react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { BoardCard } from "@/features/issues/components/BoardCard/BoardCard";
import { StatusIcon } from "@/features/issues/components/IssueIcons/IssueIcons";
import type { Issue, Status } from "@/types";
import styles from "./boardColumn.module.scss";
import { Button } from "@/components/ui/atoms/Button/Button";
import { useModal } from "@/lib/context";


interface BoardColumnProps {
  status: Status;
  issues: Issue[];
  projectId: string;
  newIssueLabel: string;
  isOver: boolean;
  dragging: string | null;
  dragOverCard: string | null;
  insertAbove: boolean;
  onColumnDragOver: (e: React.DragEvent) => void;
  onColumnDragLeave: (e: React.DragEvent) => void;
  onColumnDrop: (e: React.DragEvent) => void;
  onCardDragStart: (issue: Issue) => (e: React.DragEvent) => void;
  onCardDragEnd: () => void;
  onCardDragOver: (cardId: string) => (e: React.DragEvent) => void;
  onCardClick: (issue: Issue) => void;
}

export function BoardColumn({
  status,
  issues,
  projectId,
  newIssueLabel,
  isOver,
  dragging,
  dragOverCard,
  insertAbove,
  onColumnDragOver,
  onColumnDragLeave,
  onColumnDrop,
  onCardDragStart,
  onCardDragEnd,
  onCardDragOver,
  onCardClick,
}: BoardColumnProps) {
  const {openModal} = useModal()

  function showCreateIssueModal(){
    openModal(<div>
      HALLO ICH BIN EIN MODAL
    </div>)
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop drop zone — no native HTML element represents this
    <div
      className={`${styles.col}${isOver ? ` ${styles.dragOver}` : ""}`}
      onDragOver={onColumnDragOver}
      onDragLeave={onColumnDragLeave}
      onDrop={onColumnDrop}
    >
      <div className={styles.colHeader}>
        <StatusIcon status={status.id} size={16} />
        <span className={styles.colTitle}>{status.name}</span>
        <Badge mono>{issues.length}</Badge>
        <Button
          type="button"
          variant="ghost"
          className={`${styles.headerAdd}`}
          title={newIssueLabel}
          onClick={showCreateIssueModal}
          icon={<Icon icon="lucide:plus" width={15} />}
        />
      </div>

      <div className={styles.cards}>
        {issues.map((issue) => {
          const isCardOver = dragOverCard === issue.id && dragging !== issue.id;
          return (
            <React.Fragment key={issue.id}>
              {isCardOver && insertAbove && (
                <div className={styles.dropIndicator} />
              )}
              <BoardCard
                issue={issue}
                projectId={projectId}
                isDragging={dragging === issue.id}
                onDragStart={onCardDragStart(issue)}
                onDragEnd={onCardDragEnd}
                onDragOver={onCardDragOver(issue.id)}
                onClick={() => onCardClick(issue)}
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
          title={newIssueLabel}
          onClick={() => {}}
        >
          <Icon icon="lucide:plus" width={15} />
          <span>{newIssueLabel}</span>
        </button>
      </div>
    </div>
  );
}
