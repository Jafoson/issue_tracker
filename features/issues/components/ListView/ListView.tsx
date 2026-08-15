"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
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
import { reorderIssue, updateIssue } from "@/features/issues/actions";
import { AssigneePicker } from "@/features/issues/components/AssigneePicker/AssigneePicker";
import { IssueTitleField } from "@/features/issues/components/IssueTitleField/IssueTitleField";
import { useIssueOpen } from "@/features/issues/issue-links";
import { rankBetween, sortByRank } from "@/features/issues/rank";
import type { IssueComposerData } from "@/features/issues/types";
import { Link } from "@/i18n/navigation";
import type { IssueDetail } from "@/types";
import {
  LabelsCell,
  PriorityCell,
  ProjectCell,
  StatusCell,
  TypeCell,
  UpdatedCell,
} from "./components/IssueCells";
import { ListGroupHeader } from "./components/ListGroupHeader";
import styles from "./listView.module.scss";

interface ListViewProps {
  issues: IssueDetail[];
  /**
   * Das Projekt, in dem eine neue Aufgabe entsteht. Ohne eines — etwa bei den
   * eigenen Aufgaben quer durch alle Projekte — fehlt das „+“ im Gruppenkopf,
   * und stattdessen sagt eine Spalte je Zeile, aus welchem Projekt sie kommt.
   */
  projectId?: string;
  /**
   * Ein Bündel für alles: die Zellen lösen darüber Projekt, Zuständige, Labels,
   * Typen, Status und Prioritäten auf, die Gruppenköpfe speisen damit ihren
   * Composer. Dieselbe Prop wie beim Board.
   */
  composer: IssueComposerData;
  /** Was statt der leeren Tabelle steht. Vorgabe: „Keine Aufgaben“. */
  emptyTitle?: string;
}

/**
 * Issues als Tabelle, nach Status gruppiert. Zeile öffnet das Issue, die
 * Picker in Priorität, Status und Zuständigkeit ändern es direkt in der Liste.
 * Ziehen sortiert um — innerhalb einer Gruppe und über deren Grenze hinweg,
 * womit sich der Status ändert. Dieselbe Rangrechnung wie auf dem Board.
 */
export function ListView({
  issues,
  projectId,
  composer,
  emptyTitle,
}: ListViewProps) {
  const { projects, members, labels, statuses, priorities, issueTypes } =
    composer;
  const t = useTranslations();
  const router = useRouter();
  const issueOpen = useIssueOpen(composer.workspaceId);
  const [, startTransition] = useTransition();
  // Eingeklappte Gruppen sind reine Ansichtssache — nichts, wofür die URL oder
  // der Server etwas wissen müsste.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  // Welche Zeile gerade ihren Titel schreibt. Die Liste hält das, nicht die
  // Zelle: die Tabelle muss wissen, dass diese eine Zeile solange nicht zu
  // ziehen ist.
  const [editing, setEditing] = useState<string | null>(null);

  // Was gerade geändert wurde, steht sofort da; der Server zieht nach. Ohne das
  // spränge die Zeile für die Dauer der Aktion an ihren alten Platz — oder trüge
  // wieder ihren alten Titel.
  const [shown, applyPatch] = useOptimistic(
    issues,
    (state, patch: { id: string } & Partial<IssueDetail>) =>
      state.map((issue) =>
        issue.id === patch.id ? { ...issue, ...patch } : issue,
      ),
  );

  const saveTitle = (issue: IssueDetail, title: string) =>
    startTransition(async () => {
      applyPatch({ id: issue.id, title });
      await updateIssue(issue.id, { title });
      router.refresh();
    });

  const toggleGroup = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const identifier = (issue: IssueDetail) =>
    `${projects.find((p) => p.id === issue.project)?.prefix ?? "?"}-${issue.key}`;

  // Das offene Issue steht als Identifier in der URL — dieselbe Quelle nutzt die
  // Detailansicht, deshalb hebt sich die passende Zeile ohne eigenen State hervor.
  const openIssue = issueOpen.openIssue;

  // Workflow-Status bekommen immer eine Gruppe — auch leer, damit das "+" im
  // Kopf erreichbar bleibt. Alle übrigen nur, wenn Issues darin liegen.
  const groups: TableGroup<IssueDetail>[] = statuses
    .map((status) => ({
      status,
      // Nach Rang, nicht nach Anlagedatum — sonst stünde die Zeile nach dem
      // Ziehen wieder woanders als dort, wo sie fallen gelassen wurde.
      rows: sortByRank(shown.filter((issue) => issue.status === status.id)),
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

  const columns: TableColumn<IssueDetail>[] = [
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
    // Nur, wo die Zeilen aus verschiedenen Projekten kommen — sonst stünde in
    // jeder Zeile dasselbe.
    ...(projectId === undefined
      ? [
          {
            id: "project",
            width: "max-content",
            cell: (issue: IssueDetail) => (
              <ProjectCell issue={issue} projects={projects} />
            ),
          },
        ]
      : []),
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
      // Der Titel ist sein eigener Auslöser: anklicken und schreiben. Er liegt
      // damit über dem Zeilen-Link — geöffnet wird das Issue über den Rest der
      // Zeile.
      //
      // Ohne issue.update.any/.own bleibt es beim reinen Text: der Server
      // lehnt den Patch ohnehin ab (`updateIssue`), und ein Knopf, der nichts
      // auslöst, ist nur eine falsche Einladung.
      cell: (issue) =>
        editing === issue.id && issue.access.canEdit ? (
          <IssueTitleField
            className={styles.titleEdit}
            value={issue.title}
            onSave={(value) => saveTitle(issue, value)}
            onDone={() => setEditing(null)}
          />
        ) : issue.access.canEdit ? (
          <button
            type="button"
            className={styles.title}
            title={t("actions.editTitle")}
            onClick={() => setEditing(issue.id)}
          >
            {issue.title}
          </button>
        ) : (
          <span className={styles.title} data-readonly>
            {issue.title}
          </span>
        ),
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
  }: TableDndAnnouncement<IssueDetail>) => {
    const name = `${identifier(row)} ${row.title}`;
    if (phase === "grabbed") return t("a11y.reorderGrabbed", { name });
    if (phase === "cancelled") return t("a11y.reorderCancelled", { name });
    const group = statuses.find((status) => status.id === groupId)?.name ?? "";
    return phase === "moved"
      ? t("a11y.reorderMoved", { position, total, group })
      : t("a11y.reorderDropped", { name, position, total, group });
  };

  const dnd = useTableDnd<IssueDetail>({
    groups,
    getRowKey: (issue) => issue.id,
    // Wer gerade schreibt, wird nicht gezogen: eine ziehbare Zeile nähme dem
    // Feld darin das Markieren mit der Maus weg. Ohne issue.update.any/.own
    // auch nicht — Ziehen ändert den Status (`reorderIssue`), den der Server
    // ohne diese Rechte ablehnt.
    canDrag: (issue) => issue.id !== editing && issue.access.canEdit,
    rowLabel: (issue) =>
      t("actions.reorder", { name: `${identifier(issue)} ${issue.title}` }),
    announce,
    // Die Gruppe ist der Status: eine Zeile, die in einer anderen Gruppe landet,
    // wechselt ihn — dieselbe Aktion wie beim Ziehen auf dem Board.
    onDrop: ({ row, groupId, previous, next }) => {
      const rank = rankBetween(previous, next);
      startTransition(async () => {
        applyPatch({ id: row.id, status: groupId, rank });
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
            title={emptyTitle ?? t("empty.noIssues")}
          />
        }
      />
    </div>
  );
}
