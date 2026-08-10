"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { EmptyState } from "@/components/ui/atoms/EmptyState/EmptyState";
import { Label } from "@/components/ui/atoms/Label/Label";
import { useConfirm } from "@/components/ui/layout/ConfirmDialog/ConfirmDialog";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { Table, type TableColumn } from "@/components/ui/layout/Table/Table";
import { useTableSort } from "@/components/ui/layout/Table/useTableSort";
import { deleteLabel } from "@/features/issues/actions";
import { LabelModal } from "@/features/issues/components/LabelModal/LabelModal";
import type {
  WorkspaceLabelRow,
  WorkspaceLabelsView,
} from "@/features/workspaces/types";
import { Link } from "@/i18n/navigation";
import { useModal } from "@/lib/context";
import { projectSettingsPath } from "@/lib/nav";
import styles from "./workspaceLabels.module.scss";

interface Props extends WorkspaceLabelsView {
  workspaceId: string;
}

/**
 * Die Labels des Workspace, in zwei Listen.
 *
 * Oben, was überall gilt und sich hier ändern lässt. Darunter, was einzelnen
 * Projekten gehört: dieselben Spalten, aber ohne Knöpfe — eine Umbenennung von
 * hier aus schlüge in einem Projekt durch, das diese Seite gar nicht meint. Die
 * Zeile führt deshalb dorthin, wo das Label hingehört.
 *
 * Das Gegenstück zu `ProjectLabels`, eine Ebene höher: dort wird die geerbte
 * Liste angezeigt und ausgeblendet, hier wird sie gepflegt.
 */
export function WorkspaceLabels({
  own,
  fromProjects,
  canCreate,
  canUpdate,
  canDelete,
  workspaceId,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const confirm = useConfirm();
  const { openModal } = useModal();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const openEditor = (label?: WorkspaceLabelRow) =>
    openModal(({ close }) => (
      <LabelModal
        workspaceId={workspaceId}
        label={label}
        onDone={() => {
          setError("");
          router.refresh();
        }}
        close={close}
      />
    ));

  const remove = async (row: WorkspaceLabelRow) => {
    // Ein Workspace-Label hängt an Aufgaben aus mehreren Projekten. Die Zahl in
    // der Rückfrage ist die über alle — sie sagt, was hier verloren geht.
    const ok = await confirm({
      title: t("projectLabels.deleteTitle", { name: row.name }),
      description: t("workspaceLabels.deleteDesc", { count: row.issueCount }),
      confirmLabel: t("actions.delete"),
      cancelLabel: t("actions.cancel"),
      danger: true,
    });
    if (!ok) return;

    startTransition(async () => {
      const result = await deleteLabel(row.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError("");
      router.refresh();
    });
  };

  const newButton = canCreate && (
    <Button
      variant="primary"
      icon={<Icon icon="lucide:plus" width={15} />}
      onClick={() => openEditor()}
    >
      {t("projectLabels.newLabel")}
    </Button>
  );

  const labelCell = (row: WorkspaceLabelRow) => (
    <Label color={row.color} filled>
      {row.name}
    </Label>
  );

  const usageCell = (row: WorkspaceLabelRow) =>
    row.issueCount === 0 ? (
      <span className={styles.unused}>{t("projectLabels.unused")}</span>
    ) : (
      <span className={styles.usage}>
        {t("projectLabels.usage", { count: row.issueCount })}
      </span>
    );

  const ownColumns: TableColumn<WorkspaceLabelRow>[] = [
    {
      id: "label",
      header: t("projectLabels.colLabel"),
      width: "minmax(0, 1fr)",
      sortValue: (row) => row.name,
      cell: labelCell,
    },
    {
      id: "usage",
      header: t("projectLabels.colUsage"),
      width: "minmax(120px, max-content)",
      sortValue: (row) => row.issueCount,
      cell: usageCell,
    },
    {
      // Ein Projekt darf ein Workspace-Label bei sich ausblenden. Dass davon
      // Gebrauch gemacht wird, gehört hierher: es erklärt, warum ein Label
      // anderswo fehlt, ohne dass jemand es gelöscht hätte.
      id: "hidden",
      header: t("workspaceLabels.colHidden"),
      width: "minmax(140px, max-content)",
      sortValue: (row) => row.hiddenIn,
      cell: (row) =>
        row.hiddenIn === 0 ? (
          <span className={styles.unused}>{t("workspaceLabels.nowhere")}</span>
        ) : (
          <span className={styles.usage}>
            {t("workspaceLabels.hiddenIn", { count: row.hiddenIn })}
          </span>
        ),
    },
    ...(canUpdate || canDelete
      ? [
          {
            id: "actions",
            header: "",
            width: "84px",
            align: "end" as const,
            cell: (row: WorkspaceLabelRow) => (
              <div className={styles.rowActions}>
                {canUpdate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Icon icon="lucide:pencil" width={15} />}
                    title={t("actions.edit")}
                    aria-label={t("actions.edit")}
                    disabled={isPending}
                    onClick={() => openEditor(row)}
                  />
                )}
                {canDelete && (
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
        ]
      : []),
  ];

  const projectColumns: TableColumn<WorkspaceLabelRow>[] = [
    {
      id: "label",
      header: t("projectLabels.colLabel"),
      width: "minmax(0, 1fr)",
      sortValue: (row) => row.name,
      cell: labelCell,
    },
    {
      id: "project",
      header: t("fields.project"),
      width: "minmax(160px, max-content)",
      sortValue: (row) => row.projectName,
      cell: (row) => <span className={styles.owner}>{row.projectName}</span>,
    },
    {
      id: "usage",
      header: t("projectLabels.colUsage"),
      width: "minmax(120px, max-content)",
      sortValue: (row) => row.issueCount,
      cell: usageCell,
    },
  ];

  // Zwei Listen, zwei Sortierungen — die geerbten Projekt-Labels sind eine
  // eigene Tabelle und sollen sich nicht mitdrehen.
  const ownSort = useTableSort(ownColumns);
  const projectSort = useTableSort(projectColumns);

  return (
    <>
      <PageHeader
        divider={false}
        title={t("nav.labels")}
        count={own.length}
        description={t("workspaceLabels.subtitle")}
        actions={newButton}
      />

      <div className={styles.content}>
        {error && (
          <p className={styles.error} role="alert">
            <Icon icon="lucide:circle-alert" width={14} />
            {error}
          </p>
        )}

        <Table
          variant="card"
          label={t("nav.labels")}
          columns={ownColumns}
          rows={ownSort.sortRows(own)}
          sort={ownSort.sort}
          getRowKey={(row) => row.id}
          empty={
            <EmptyState
              icon={<Icon icon="lucide:tag" width={32} />}
              title={t("workspaceLabels.emptyTitle")}
              description={t("workspaceLabels.emptyDesc")}
              action={newButton}
            />
          }
        />

        {fromProjects.length > 0 && (
          <section className={styles.group}>
            <h2 className={styles.groupTitle}>
              {t("workspaceLabels.fromProjectsTitle")}
            </h2>
            <p className={styles.groupDesc}>
              {t("workspaceLabels.fromProjectsDesc")}
            </p>

            <Table
              variant="card"
              label={t("workspaceLabels.fromProjectsTitle")}
              columns={projectColumns}
              rows={projectSort.sortRows(fromProjects)}
              sort={projectSort.sort}
              getRowKey={(row) => row.id}
              // Geändert wird ein Projekt-Label dort, wo es hingehört — die
              // Zeile bringt einen hin, statt den Weg nur zu behaupten.
              rowOverlay={(row) =>
                row.projectSlug ? (
                  <Link
                    href={projectSettingsPath(
                      workspaceId,
                      row.projectSlug,
                      "labels",
                    )}
                    aria-label={row.name}
                  />
                ) : null
              }
            />
          </section>
        )}
      </div>
    </>
  );
}
