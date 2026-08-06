"use client";
import { Icon } from "@iconify/react";
import React from "react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Button } from "@/components/ui/atoms/Button/Button";
import { BoardCard } from "@/features/issues/components/BoardCard/BoardCard";
import { CreateIssueModal } from "@/features/issues/components/CreateIssueModal/CreateIssueModal";
import { StatusIcon } from "@/features/issues/components/IssueIcons/IssueIcons";
import type { IssueComposerData, IssueLookups } from "@/features/issues/types";
import { useModal } from "@/lib/context";
import type { Issue, Status } from "@/types";
import styles from "./boardColumn.module.scss";

interface BoardColumnProps {
  status: Status;
  issues: Issue[];
  projectId: string;
  lookups: IssueLookups;
  composer: IssueComposerData;
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
  /** Ob dieses Issue gerade im Seitenpanel steht. */
  isCardActive: (issue: Issue) => boolean;
  onCardOpen: (issue: Issue) => void;
  /** Strg/Cmd- und Mittelklick auf eine Karte: Vollseite im neuen Tab. */
  onCardOpenInNewTab: (issue: Issue) => void;
}

export function BoardColumn({
  status,
  issues,
  projectId,
  lookups,
  composer,
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
  isCardActive,
  onCardOpen,
  onCardOpenInNewTab,
}: BoardColumnProps) {
  const { openModal } = useModal();

  // Ohne `issue.create` in diesem Projekt gibt es weder das Plus im Spaltenkopf
  // noch die Zeile am Ende der Spalte. Der Server hat das schon entschieden
  // (`creatableProjectIds`), hier wird es nur nicht gezeichnet.
  const canCreate = composer.creatableProjectIds.includes(projectId);

  function showCreateIssueModal() {
    openModal(({ close }) => (
      <CreateIssueModal
        projectId={projectId}
        initialStatus={status.id}
        data={composer}
        close={close}
      />
    ));
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
        <StatusIcon status={status.id} size={16} color={status.color} />
        <span className={styles.colTitle}>{status.name}</span>
        <Badge mono>{issues.length}</Badge>
        {canCreate && (
          <Button
            type="button"
            variant="ghost"
            className={`${styles.headerAdd}`}
            title={newIssueLabel}
            onClick={showCreateIssueModal}
            icon={<Icon icon="lucide:plus" width={15} />}
          />
        )}
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
                lookups={lookups}
                isDragging={dragging === issue.id}
                isActive={isCardActive(issue)}
                onDragStart={onCardDragStart(issue)}
                onDragEnd={onCardDragEnd}
                onDragOver={onCardDragOver(issue.id)}
                onOpen={() => onCardOpen(issue)}
                onOpenInNewTab={() => onCardOpenInNewTab(issue)}
              />
              {isCardOver && !insertAbove && (
                <div className={styles.dropIndicator} />
              )}
            </React.Fragment>
          );
        })}
        {canCreate && (
          <button
            type="button"
            className={styles.addCard}
            title={newIssueLabel}
            onClick={showCreateIssueModal}
          >
            <Icon icon="lucide:plus" width={15} />
            <span>{newIssueLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}
