"use client";

import { Icon } from "@iconify/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { EmptyState } from "@/components/ui/atoms/EmptyState/EmptyState";
import {
  Table,
  type TableColumn,
  type TableGroup,
} from "@/components/ui/layout/Table/Table";
import {
  type TableDndAnnouncement,
  useTableDnd,
} from "@/components/ui/layout/Table/useTableDnd";
import { reorderIssue } from "@/features/issues/actions";
import { AssigneePicker } from "@/features/issues/components/AssigneePicker/AssigneePicker";
import { ISSUE_PARAM, useIssueOpen } from "@/features/issues/issue-links";
import { rankBetween, sortByRank } from "@/features/issues/rank";
import type { IssueComposerData } from "@/features/issues/types";
import { Link } from "@/i18n/navigation";
import type { Issue } from "@/types";
import {
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
 * Ziehen sortiert um — innerhalb einer Gruppe und über deren Grenze hinweg,
 * womit sich der Status ändert. Dieselbe Rangrechnung wie auf dem Board.
 */
export function ListView({ issues, projectId, composer }: ListViewProps) {
  const { projects, members, labels, statuses, priorities, issueTypes } =
    composer;
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const issueOpen = useIssueOpen(composer.workspaceId);
  const [, startTransition] = useTransition();
  // Eingeklappte Gruppen sind reine Ansichtssache — nichts, wofür die URL oder
  // der Server etwas wissen müsste.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  // Die umsortierte Zeile sitzt sofort an ihrem neuen Platz; der Server zieht
  // nach. Ohne das spränge sie für die Dauer der Aktion zurück.
  const [ordered, moveIssue] = useOptimistic(
    issues,
    (state, move: { id: string; status: string; rank: number }) =>
      state.map((issue) =>
        issue.id === move.id
          ? { ...issue, status: move.status, rank: move.rank }
          : issue,
      ),
  );

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
  const openIssue = searchParams.get(ISSUE_PARAM);

  // Workflow-Status bekommen immer eine Gruppe — auch leer, damit das "+" im
  // Kopf erreichbar bleibt. Alle übrigen nur, wenn Issues darin liegen.
  const groups: TableGroup<Issue>[] = statuses
    .map((status) => ({
      status,
      // Nach Rang, nicht nach Anlagedatum — sonst stünde die Zeile nach dem
      // Ziehen wieder woanders als dort, wo sie fallen gelassen wurde.
      rows: sortByRank(ordered.filter((issue) => issue.status === status.id)),
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
      cell: (issue) => <AssigneePicker issue={issue} members={members} />,
    },
    {
      id: "updated",
      width: "max-content",
      align: "end",
      cell: (issue) => <UpdatedCell issue={issue} />,
    },
  ];

  // Was der Screenreader beim Sortieren per Tastatur hört. Die Tabelle kennt
  // weder Sprache noch Status — sie liefert nur Zeile, Gruppe und Position.
  const announce = ({
    row,
    groupId,
    position,
    total,
    phase,
  }: TableDndAnnouncement<Issue>) => {
    const name = `${identifier(row)} ${row.title}`;
    if (phase === "grabbed") return t("a11y.reorderGrabbed", { name });
    if (phase === "cancelled") return t("a11y.reorderCancelled", { name });
    const group = statuses.find((status) => status.id === groupId)?.name ?? "";
    return phase === "moved"
      ? t("a11y.reorderMoved", { position, total, group })
      : t("a11y.reorderDropped", { name, position, total, group });
  };

  const dnd = useTableDnd<Issue>({
    groups,
    getRowKey: (issue) => issue.id,
    rowLabel: (issue) =>
      t("actions.reorder", { name: `${identifier(issue)} ${issue.title}` }),
    announce,
    // Die Gruppe ist der Status: eine Zeile, die in einer anderen Gruppe landet,
    // wechselt ihn — dieselbe Aktion wie beim Ziehen auf dem Board.
    onDrop: ({ row, groupId, previous, next }) => {
      const rank = rankBetween(previous, next);
      startTransition(async () => {
        moveIssue({ id: row.id, status: groupId, rank });
        await reorderIssue(row.id, groupId, rank);
        router.refresh();
      });
    },
  });

  return (
    <div className={styles.content}>
      <Table
        fill
        variant="card"
        label={t("nav.issues")}
        columns={columns}
        groups={groups}
        getRowKey={(issue) => issue.id}
        dnd={dnd}
        isRowActive={(issue) => identifier(issue) === openIssue}
        rowOverlay={(issue) => (
          <Link
            {...issueOpen.linkProps(identifier(issue))}
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
