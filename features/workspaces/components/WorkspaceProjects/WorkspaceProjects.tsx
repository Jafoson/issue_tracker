"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Avatar, AvatarStack } from "@/components/ui/atoms/Avatar/Avatar";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Button } from "@/components/ui/atoms/Button/Button";
import { EmptyState } from "@/components/ui/atoms/EmptyState/EmptyState";
import { useConfirm } from "@/components/ui/layout/ConfirmDialog/ConfirmDialog";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { LoadMoreSentinel } from "@/components/ui/layout/Table/LoadMoreSentinel/LoadMoreSentinel";
import { Table, type TableColumn } from "@/components/ui/layout/Table/Table";
import { useInfiniteScroll } from "@/components/ui/layout/Table/useInfiniteScroll";
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

type LoadMoreProjects = (
  cursor: string,
) => Promise<{ items: WorkspaceProjectRow[]; nextCursor: string | null }>;

interface Props extends WorkspaceProjectsView {
  workspaceId: string;
  /** Lädt die nächste Seite der einen Liste (ohne `seesAllProjects`),
   * `loadMoreWorkspaceProjects` in `features/workspaces/actions.ts`. */
  loadMore: LoadMoreProjects;
  /** Lädt die nächste Seite der offenen Projekte (bei `seesAllProjects`). */
  loadMorePublic: LoadMoreProjects;
  /** Lädt die nächste Seite der privaten Projekte (bei `seesAllProjects`). */
  loadMorePrivate: LoadMoreProjects;
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
  publicRows,
  privateRows,
  canCreate,
  seesAllProjects,
  workspaceId,
  nextCursor,
  publicNextCursor,
  privateNextCursor,
  loadMore,
  loadMorePublic,
  loadMorePrivate,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const confirm = useConfirm();
  const { openModal } = useModal();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  // Immer alle drei — welche davon etwas anzeigt, entscheidet erst das Rendern
  // weiter unten (`seesAllProjects`). Hooks lassen sich nicht bedingt aufrufen.
  const singleScroll = useInfiniteScroll({
    initialItems: rows,
    initialCursor: nextCursor,
    loadMore,
  });
  const publicScroll = useInfiniteScroll({
    initialItems: publicRows,
    initialCursor: publicNextCursor,
    loadMore: loadMorePublic,
  });
  const privateScroll = useInfiniteScroll({
    initialItems: privateRows,
    initialCursor: privateNextCursor,
    loadMore: loadMorePrivate,
  });

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
          <Avatar
            avatar={{
              name: row.name,
              color: row.color,
              image: row.avatarUrl ?? undefined,
            }}
            shape="square"
            size={28}
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

  // Drei Sortierungen für drei mögliche Tabellen — wie bei den Labels: die
  // Listen stehen nebeneinander und sollen sich einzeln ordnen lassen.
  const singleSort = useTableSort(columns);
  const publicSort = useTableSort(columns);
  const privateSort = useTableSort(columns);

  // Die Zeile führt ins Projekt — als Link, damit Tastatur, Mittelklick und
  // „in neuem Tab öffnen" mitkommen. Alle Tabellen benutzen denselben.
  const rowOverlay = (row: WorkspaceProjectRow) => (
    <Link href={projectPath(workspaceId, row.slug, "")} aria-label={row.name} />
  );

  const totalCount = seesAllProjects
    ? publicScroll.items.length + privateScroll.items.length
    : singleScroll.items.length;

  return (
    <>
      <PageHeader
        divider={false}
        title={t("nav.projects")}
        count={totalCount}
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
        {totalCount === 0 ? (
          <Table
            variant="card"
            label={t("nav.projects")}
            columns={columns}
            rows={[]}
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
        ) : seesAllProjects ? (
          <>
            {/* Offen zuerst: das ist der Normalfall eines Workspace und die
                längere Liste. Eine leere Hälfte fällt weg — eine Überschrift
                ohne Zeilen darunter behauptet eine Aufteilung, die es gerade
                nicht gibt. */}
            {publicScroll.items.length > 0 && (
              <section className={styles.group}>
                {/* Das Schloss bzw. die Weltkugel steht dabei, weil „privat"
                    ein Zustand ist und kein Titel. */}
                <h2 className={styles.groupTitle}>
                  <Icon
                    icon="lucide:globe"
                    width={15}
                    className={styles.groupIcon}
                    aria-hidden
                  />
                  {t("workspaceProjects.publicGroup")}
                  <span className={styles.groupCount}>
                    {publicScroll.items.length}
                  </span>
                </h2>
                <p className={styles.groupDesc}>
                  {t("workspaceProjects.publicDesc")}
                </p>

                <Table
                  fill
                  variant="card"
                  label={t("workspaceProjects.publicGroup")}
                  columns={columns}
                  rows={publicSort.sortRows(publicScroll.items)}
                  sort={publicSort.sort}
                  getRowKey={(row) => row.id}
                  rowOverlay={rowOverlay}
                  footer={
                    publicScroll.cursor && (
                      <LoadMoreSentinel
                        ref={publicScroll.sentinelRef}
                        loading={publicScroll.loading}
                      />
                    )
                  }
                />
              </section>
            )}

            {privateScroll.items.length > 0 && (
              <section className={styles.group}>
                <h2 className={styles.groupTitle}>
                  <Icon
                    icon="lucide:lock"
                    width={15}
                    className={styles.groupIcon}
                    aria-hidden
                  />
                  {t("workspaceProjects.privateGroup")}
                  <span className={styles.groupCount}>
                    {privateScroll.items.length}
                  </span>
                </h2>
                <p className={styles.groupDesc}>
                  {t("workspaceProjects.privateDesc")}
                </p>

                <Table
                  fill
                  variant="card"
                  label={t("workspaceProjects.privateGroup")}
                  columns={columns}
                  rows={privateSort.sortRows(privateScroll.items)}
                  sort={privateSort.sort}
                  getRowKey={(row) => row.id}
                  rowOverlay={rowOverlay}
                  footer={
                    privateScroll.cursor && (
                      <LoadMoreSentinel
                        ref={privateScroll.sentinelRef}
                        loading={privateScroll.loading}
                      />
                    )
                  }
                />
              </section>
            )}
          </>
        ) : (
          // Ohne Aufteilung bleibt es die eine Liste, die sie vorher war: keine
          // Überschrift, kein Vorspann.
          <section className={styles.group}>
            <Table
              fill
              variant="card"
              label={t("nav.projects")}
              columns={columns}
              rows={singleSort.sortRows(singleScroll.items)}
              sort={singleSort.sort}
              getRowKey={(row) => row.id}
              rowOverlay={rowOverlay}
              footer={
                singleScroll.cursor && (
                  <LoadMoreSentinel
                    ref={singleScroll.sentinelRef}
                    loading={singleScroll.loading}
                  />
                )
              }
            />
          </section>
        )}
      </div>
    </>
  );
}
