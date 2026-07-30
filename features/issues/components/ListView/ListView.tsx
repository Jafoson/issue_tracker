"use client";

import { Icon } from "@iconify/react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { EmptyState } from "@/components/ui/atoms/EmptyState/EmptyState";
import {
  Table,
  type TableColumn,
  type TableGroup,
} from "@/components/ui/layout/Table/Table";
import type { IssueComposerData } from "@/features/issues/types";
import { Link, usePathname } from "@/i18n/navigation";
import type { Issue } from "@/types";
import {
  AssigneeCell,
  LabelsCell,
  PriorityCell,
  StatusCell,
  TypeCell,
  UpdatedCell,
} from "./components/IssueCells";
import { ListGroupHeader } from "./components/ListGroupHeader";
import styles from "./listView.module.scss";

interface ListViewProps {
  issues: Issue[];
  projectId: string;
  /**
   * Ein Bündel für alles: die Zellen lösen darüber Projekt, Zuständige, Labels,
   * Typen, Status und Prioritäten auf, die Gruppenköpfe speisen damit ihren
   * Composer. Dieselbe Prop wie beim Board.
   */
  composer: IssueComposerData;
}

/**
 * Issues als Tabelle, nach Status gruppiert. Zeile öffnet das Issue, die
 * Picker in Priorität, Status und Zuständigkeit ändern es direkt in der Liste.
 */
export function ListView({ issues, projectId, composer }: ListViewProps) {
  const { projects, members, labels, statuses, priorities, issueTypes } =
    composer;
  const t = useTranslations();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Eingeklappte Gruppen sind reine Ansichtssache — nichts, wofür die URL oder
  // der Server etwas wissen müsste.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const toggleGroup = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const identifier = (issue: Issue) =>
    `${projects.find((p) => p.id === issue.project)?.prefix ?? "?"}-${issue.key}`;

  // Das offene Issue steht als Identifier in der URL — dieselbe Quelle nutzt die
  // Detailansicht, deshalb hebt sich die passende Zeile ohne eigenen State hervor.
  const openIssue = searchParams.get("issue");

  const issueHref = (issue: Issue) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("issue", identifier(issue));
    return `${pathname}?${params.toString()}`;
  };

  // Workflow-Status bekommen immer eine Gruppe — auch leer, damit das "+" im
  // Kopf erreichbar bleibt. Alle übrigen nur, wenn Issues darin liegen.
  const groups: TableGroup<Issue>[] = statuses
    .map((status) => ({
      status,
      rows: issues.filter((issue) => issue.status === status.id),
    }))
    .filter(({ status, rows }) => status.isColumn || rows.length > 0)
    .map(({ status, rows }) => ({
      id: status.id,
      label: status.name,
      collapsed: collapsed.has(status.id),
      header: (
        <ListGroupHeader
          status={status}
          count={rows.length}
          projectId={projectId}
          composer={composer}
          collapsed={collapsed.has(status.id)}
          onToggle={() => toggleGroup(status.id)}
        />
      ),
      rows,
    }));

  const columns: TableColumn<Issue>[] = [
    {
      id: "priority",
      cell: (issue) => <PriorityCell issue={issue} priorities={priorities} />,
    },
    {
      id: "identifier",
      cell: (issue) => (
        <span className={styles.identifier}>{identifier(issue)}</span>
      ),
    },
    {
      id: "status",
      cell: (issue) => <StatusCell issue={issue} statuses={statuses} />,
    },
    {
      id: "type",
      cell: (issue) => <TypeCell issue={issue} issueTypes={issueTypes} />,
    },
    {
      id: "title",
      width: "minmax(0, 1fr)",
      cell: (issue) => <span className={styles.title}>{issue.title}</span>,
    },
    {
      id: "labels",
      width: "max-content",
      align: "end",
      cell: (issue) => <LabelsCell issue={issue} labels={labels} />,
    },
    {
      id: "assignee",
      align: "end",
      cell: (issue) => <AssigneeCell issue={issue} members={members} />,
    },
    {
      id: "updated",
      width: "max-content",
      align: "end",
      cell: (issue) => <UpdatedCell issue={issue} />,
    },
  ];

  return (
    <div className={styles.content}>
      <Table
        fill
        variant="card"
        label={t("nav.issues")}
        columns={columns}
        groups={groups}
        getRowKey={(issue) => issue.id}
        isRowActive={(issue) => identifier(issue) === openIssue}
        rowOverlay={(issue) => (
          <Link
            href={issueHref(issue)}
            scroll={false}
            aria-label={`${identifier(issue)} ${issue.title}`}
          />
        )}
        empty={
          <EmptyState
            icon={<Icon icon="lucide:list" width={32} />}
            title={t("empty.noIssues")}
          />
        }
      />
    </div>
  );
}
