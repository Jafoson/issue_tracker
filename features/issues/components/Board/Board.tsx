"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { BoardColumn } from "@/features/issues/components/BoardColumn/BoardColumn";
import type { IssueLookups } from "@/features/issues/types";
import type { Issue, Status } from "@/types";
import styles from "./board.module.scss";
import { useBoardDnd } from "./useBoardDnd";

interface BoardProps {
  issues: Issue[];
  projectId: string;
  statuses: Status[];
  lookups: IssueLookups;
}

export function Board({ issues, projectId, statuses, lookups }: BoardProps) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const columnStatuses = statuses.filter((s) => s.isColumn);

  const board = useBoardDnd(issues);

  const openIssue = (issue: Issue) => {
    const prefix =
      lookups.projects.find((p) => p.id === issue.project)?.prefix ?? "?";
    const p = new URLSearchParams(searchParams.toString());
    p.set("issue", `${prefix}-${issue.key}`);
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };

  return (
    <div className={styles.board}>
      {columnStatuses.map((status) => {
        const { isOver, onDragOver, onDragLeave, onDrop } =
          board.columnHandlers(status.id);
        return (
          <BoardColumn
            key={status.id}
            status={status}
            issues={board.getColumnIssues(status.id)}
            projectId={projectId}
            lookups={lookups}
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
            onCardClick={openIssue}
          />
        );
      })}
    </div>
  );
}
