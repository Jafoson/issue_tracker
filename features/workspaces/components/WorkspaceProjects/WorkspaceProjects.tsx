"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { AvatarStack } from "@/components/ui/atoms/Avatar/Avatar";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Button } from "@/components/ui/atoms/Button/Button";
import { EmptyState } from "@/components/ui/atoms/EmptyState/EmptyState";
import { useConfirm } from "@/components/ui/layout/ConfirmDialog/ConfirmDialog";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { Table, type TableColumn } from "@/components/ui/layout/Table/Table";
import { useTableSort } from "@/components/ui/layout/Table/useTableSort";
import { deleteProject } from "@/features/projects/actions";
import { CreateProjectModal } from "@/features/projects/components/CreateProjectModal/CreateProjectModal";
import type {
  WorkspaceProjectRow,
  WorkspaceProjectsView,
} from "@/features/workspaces/types";
import { Link } from "@/i18n/navigation";
import { useModal } from "@/lib/context";
import { projectPath } from "@/lib/nav";
import { EditProjectModal } from "./components/EditProjectModal";
import styles from "./workspaceProjects.module.scss";

interface Props extends WorkspaceProjectsView {
  workspaceId: string;
}

/**
 * Alle Projekte des Workspace in einer Liste — mit dem, was sich an ihnen von
 * hier aus ändern lässt.
 *
 * Die Zeile führt ins Projekt; geändert wird im Dialog daneben. Beides gehört
 * zusammen: wer die Übersicht öffnet, will meist nachsehen und nicht umbauen,
 * und ein Feld, das schon beim Tippen wirkt, wäre in einer Liste aus zwanzig
 * Zeilen ein Versehen zu viel.
 *
 * `canUpdate` und `canDelete` stehen an jeder Zeile, nicht an der Seite: die
 * beiden Rechte gelten im Projekt. Wer eines leitet, sieht seine Knöpfe genau
 * dort — und an den übrigen Zeilen keine.
 *
 * Wer jedes Projekt des Workspace sieht (`seesAllProjects`), bekommt sie in zwei
 * Abschnitten: offen und privat, jeder mit eigener Überschrift, eigenem
 * Vorspann und eigener Tabelle. Dieselbe Gliederung wie auf der Label-Seite —
 * dort stehen die eigenen Labels über den geerbten. Zwei Listen mit einem Satz
 * dazu sagen mehr als eine Liste mit einer Spalte „Sichtbarkeit": sie erklären
 * auch, was der Unterschied bedeutet. Die Spalte entfällt dafür.
 *
 * Für alle anderen bleibt es bei einer Liste samt Spalte: sie sehen ohnehin nur
 * ihren Ausschnitt, und eine Überschrift „Privat" über drei von zwölf Projekten
 * führte in die Irre.
 */
export function WorkspaceProjects({
  rows,
  canCreate,
  seesAllProjects,
  workspaceId,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const confirm = useConfirm();
  const { openModal } = useModal();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const done = () => {
    setError("");
    router.refresh();
  };

  const openCreate = () =>
    openModal(({ close }) => (
      <CreateProjectModal workspaceId={workspaceId} close={close} />
    ));

  const openEdit = (row: WorkspaceProjectRow) =>
    openModal(({ close }) => (
      <EditProjectModal project={row} onDone={done} close={close} />
    ));

  const remove = async (row: WorkspaceProjectRow) => {
    // Die Zahl steht in der Rückfrage, weil sie den Unterschied macht: ein
    // leeres Projekt zu löschen ist Aufräumen, ein volles ist ein Verlust.
    const ok = await confirm({
      title: t("workspaceProjects.deleteTitle", { name: row.name }),
      description: t("projectSettings.deleteDesc", { count: row.issueCount }),
      confirmLabel: t("actions.delete"),
      cancelLabel: t("actions.cancel"),
      danger: true,
    });
    if (!ok) return;

    startTransition(async () => {
      const result = await deleteProject(row.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      done();
    });
  };

  const newButton = canCreate && (
    <Button
      variant="primary"
      icon={<Icon icon="lucide:plus" width={15} />}
      onClick={openCreate}
    >
      {t("actions.newProject")}
    </Button>
  );

  const columns: TableColumn<WorkspaceProjectRow>[] = [
    {
      id: "project",
      header: t("fields.project"),
      width: "minmax(0, 1fr)",
      sortValue: (row) => row.name,
      cell: (row) => (
        <span className={styles.project}>
          <span
            className={styles.dot}
            style={{ background: row.color }}
            aria-hidden
          />
          <span className={styles.name}>{row.name}</span>
          <span className={styles.prefix}>{row.prefix}</span>
        </span>
      ),
    },
    // Gruppiert steht die Sichtbarkeit im Bandkopf — zweimal dasselbe in einer
    // Zeile wäre nur breiter, nicht klarer.
    ...(seesAllProjects
      ? []
      : [
          {
            id: "visibility",
            header: t("projectSettings.visibility"),
            width: "minmax(110px, max-content)",
            sortValue: (row: WorkspaceProjectRow) => row.visibility,
            cell: (row: WorkspaceProjectRow) => (
              <Badge mono={false}>
                {row.visibility === "public"
                  ? t("projectSettings.public")
                  : t("projectSettings.private")}
              </Badge>
            ),
          },
        ]),
    {
      id: "members",
      header: t("nav.members"),
      width: "minmax(140px, max-content)",
      align: "end",
      sortValue: (row) => row.memberCount,
      // Gesichter und Zahl: der Stapel beantwortet „wer ist da drin", die Zahl
      // „wie viele". Der Stapel zeigt die ersten vier, deshalb steht die
      // Gesamtzahl daneben statt als „+n" darin.
      cell: (row) => (
        <span className={styles.members}>
          {row.members.length > 0 && (
            <AvatarStack
              ids={row.members.map((member) => member.id)}
              users={row.members}
              size={22}
              max={4}
            />
          )}
          <span className={styles.count}>{row.memberCount}</span>
        </span>
      ),
    },
    {
      id: "issues",
      header: t("nav.issues"),
      width: "minmax(90px, max-content)",
      align: "end",
      sortValue: (row) => row.issueCount,
      cell: (row) => <span className={styles.count}>{row.issueCount}</span>,
    },
    {
      id: "actions",
      header: "",
      width: "84px",
      align: "end",
      cell: (row) => (
        <div className={styles.rowActions}>
          {row.canUpdate && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon icon="lucide:pencil" width={15} />}
              title={t("actions.edit")}
              aria-label={t("actions.edit")}
              disabled={isPending}
              onClick={() => openEdit(row)}
            />
          )}
          {row.canDelete && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon icon="lucide:trash-2" width={15} />}
              title={t("actions.delete")}
              aria-label={t("actions.delete")}
              disabled={isPending}
              onClick={() => remove(row)}
            />
          )}
        </div>
      ),
    },
  ];

  // Zwei Tabellen, zwei Sortierungen — wie bei den Labels: die Listen stehen
  // nebeneinander und sollen sich einzeln ordnen lassen. Ungruppiert trägt die
  // erste die ganze Liste, die zweite entfällt.
  const openList = useTableSort(columns);
  const privateList = useTableSort(columns);

  // Offen zuerst: das ist der Normalfall eines Workspace und die längere Liste.
  // Eine leere Hälfte fällt weg — eine Überschrift ohne Zeilen darunter
  // behauptet eine Aufteilung, die es gerade nicht gibt.
  const sections = seesAllProjects
    ? [
        {
          id: "public",
          heading: {
            icon: "lucide:globe",
            title: t("workspaceProjects.publicGroup"),
            desc: t("workspaceProjects.publicDesc"),
          },
          rows: rows.filter((row) => row.visibility === "public"),
          list: openList,
        },
        {
          id: "private",
          heading: {
            icon: "lucide:lock",
            title: t("workspaceProjects.privateGroup"),
            desc: t("workspaceProjects.privateDesc"),
          },
          rows: rows.filter((row) => row.visibility === "private"),
          list: privateList,
        },
      ].filter((section) => section.rows.length > 0)
    : // Ohne Aufteilung bleibt es die eine Liste, die sie vorher war: keine
      // Überschrift, kein Vorspann.
      [{ id: "all", heading: null, rows, list: openList }];

  // Die Zeile führt ins Projekt — als Link, damit Tastatur, Mittelklick und
  // „in neuem Tab öffnen" mitkommen. Beide Tabellen benutzen denselben.
  const rowOverlay = (row: WorkspaceProjectRow) => (
    <Link href={projectPath(workspaceId, row.slug, "")} aria-label={row.name} />
  );

  return (
    <>
      <PageHeader
        divider={false}
        title={t("nav.projects")}
        count={rows.length}
        description={t("workspaceProjects.subtitle")}
        actions={newButton}
      />

      <div className={styles.content}>
        {error && (
          <p className={styles.error} role="alert">
            <Icon icon="lucide:circle-alert" width={14} />
            {error}
          </p>
        )}

        {/* Gibt es gar kein Projekt, bleibt eine Tabelle stehen — die leere
            Seite gehört ihr, und zwei Überschriften über nichts wären zwei zu
            viel. */}
        {rows.length === 0 ? (
          <Table
            variant="card"
            label={t("nav.projects")}
            columns={columns}
            rows={rows}
            getRowKey={(row) => row.id}
            empty={
              <EmptyState
                icon={<Icon icon="lucide:folders" width={32} />}
                title={t("workspaceProjects.emptyTitle")}
                description={t("workspaceProjects.emptyDesc")}
                action={newButton}
              />
            }
          />
        ) : (
          sections.map((section) => (
            <section key={section.id} className={styles.group}>
              {section.heading && (
                <>
                  {/* Das Schloss bzw. die Weltkugel steht dabei, weil „privat"
                      ein Zustand ist und kein Titel. */}
                  <h2 className={styles.groupTitle}>
                    <Icon
                      icon={section.heading.icon}
                      width={15}
                      className={styles.groupIcon}
                      aria-hidden
                    />
                    {section.heading.title}
                    <span className={styles.groupCount}>
                      {section.rows.length}
                    </span>
                  </h2>
                  <p className={styles.groupDesc}>{section.heading.desc}</p>
                </>
              )}

              <Table
                variant="card"
                label={section.heading?.title ?? t("nav.projects")}
                columns={columns}
                rows={section.list.sortRows(section.rows)}
                sort={section.list.sort}
                getRowKey={(row) => row.id}
                rowOverlay={rowOverlay}
              />
            </section>
          ))
        )}
      </div>
    </>
  );
}
