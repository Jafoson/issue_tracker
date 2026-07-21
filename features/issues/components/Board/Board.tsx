"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { BoardColumn } from "@/features/issues/components/BoardColumn/BoardColumn";
import { useWorkspace } from "@/lib/workspace-context";
import type { Issue } from "@/types";
import styles from "./board.module.scss";
import { useBoardDnd } from "./useBoardDnd";

interface BoardProps {
  issues: Issue[];
  projectId: string;
}

export function Board({ issues, projectId }: BoardProps) {
  const { statuses, projects } = useWorkspace();
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const columnStatuses = statuses.filter((s) => s.isColumn);

  const board = useBoardDnd(issues);

  const openIssue = (issue: Issue) => {
    const prefix = projects.find((p) => p.id === issue.project)?.prefix ?? "?";
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
