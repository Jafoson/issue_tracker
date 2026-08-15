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
   * Das Projekt, in dem eine neue Aufgabe entsteht. Ohne eines — etwa bei den
   * eigenen Aufgaben, die quer durch alle Projekte gehen — zeigen die Spalten
   * dieselben Karten, nur ohne „Neue Aufgabe“: dafür müsste erst feststehen,
   * wohin sie gehörte.
   */
  projectId?: string;
  statuses: Status[];
  /** Speist den Composer der Spalten — die Karten-Lookups leiten sich daraus ab. */
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
  // Shift + Rad schiebt die Spalten waagerecht, egal worüber der Zeiger steht.
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
            // Ohne eigenes Projekt kommen die Karten aus verschiedenen — dann
            // sagt jede, aus welchem.
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
