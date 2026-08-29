"use client";
import { useTranslations } from "next-intl";
import { BoardColumn } from "@/features/issues/components/BoardColumn/BoardColumn";
import { useIssueOpen } from "@/features/issues/issue-links";
import type { IssueComposerData, IssueLookups } from "@/features/issues/types";
import { useShiftScroll } from "@/lib/utils/useShiftScroll";
import type { IssueDetail, Status } from "@/types";
import styles from "./board.module.scss";
import { useBoardDnd } from "./useBoardDnd";

interface BoardProps {
  issues: IssueDetail[];
  /**
   * The project a new task is created in. Without one — for instance for
   * "my issues", which spans all projects — the columns show the same
   * cards, just without "New task": that would first require knowing which
   * project it belonged to.
   */
  projectId?: string;
  statuses: Status[];
  /** Feeds the columns' composer — the card lookups are derived from it. */
  composer: IssueComposerData;
}

export function Board({ issues, projectId, statuses, composer }: BoardProps) {
  const lookups: IssueLookups = {
    projects: composer.projects,
    members: composer.members,
    labels: composer.labels,
    issueTypes: composer.issueTypes,
  };
  const t = useTranslations();
  const columnStatuses = statuses.filter((s) => s.isColumn);
  const issueOpen = useIssueOpen(composer.workspaceId);

  const board = useBoardDnd(issues);
  // Shift + wheel scrolls the columns horizontally, no matter where the pointer is.
  const scrollRef = useShiftScroll();

  const identifier = (issue: IssueDetail) =>
    `${lookups.projects.find((p) => p.id === issue.project)?.prefix ?? "?"}-${issue.key}`;

  return (
    <div ref={scrollRef} className={styles.board}>
      {columnStatuses.map((status) => {
        const { isOver, onDragOver, onDragLeave, onDrop } =
          board.columnHandlers(status.id);
        return (
          <BoardColumn
            key={status.id}
            status={status}
            issues={board.getColumnIssues(status.id)}
            projectId={projectId}
            // Without a fixed project the cards come from various ones — so
            // each one states which.
            showProject={projectId === undefined}
            lookups={lookups}
            composer={composer}
            newIssueLabel={t("actions.newIssue")}
            isOver={isOver}
            dragging={board.dragging}
            dragOverCard={board.dragOverCard}
            insertAbove={board.insertAbove}
            onColumnDragOver={onDragOver}
            onColumnDragLeave={onDragLeave}
            onColumnDrop={onDrop}
            onCardDragStart={board.onDragStart}
            onCardDragEnd={board.onDragEnd}
            onCardDragOver={board.onCardDragOver}
            isCardActive={(issue) => identifier(issue) === issueOpen.openIssue}
            onCardOpen={(issue) => issueOpen.openPanel(identifier(issue))}
            onCardOpenInNewTab={(issue) =>
              issueOpen.openPageInNewTab(identifier(issue))
            }
          />
        );
      })}
    </div>
  );
}
