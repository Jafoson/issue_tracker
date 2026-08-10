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
import { deleteLabel, setLabelHidden } from "@/features/issues/actions";
import { LabelModal } from "@/features/issues/components/LabelModal/LabelModal";
import type {
  ProjectLabelRow,
  ProjectLabelsView,
} from "@/features/projects/types";
import { useModal } from "@/lib/context";
import styles from "./projectLabels.module.scss";

interface Props extends ProjectLabelsView {
  projectId: string;
  projectName: string;
  workspaceId: string;
}

/**
 * Die Labels eines Projekts, in zwei Listen.
 *
 * Oben, was dem Projekt gehört und sich hier ändern lässt. Darunter, was der
 * Workspace vorgibt: dieselben Spalten, aber ohne Knöpfe. Beides zusammen
 * ergibt, was an einem Issue dieses Projekts auswählbar ist — die zweite Liste
 * wegzulassen hieße, die Hälfte davon zu verschweigen.
 */
export function ProjectLabels({
  projectId,
  projectName,
  workspaceId,
  own,
  inherited,
  canCreate,
  canUpdate,
  canDelete,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const confirm = useConfirm();
  const { openModal } = useModal();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const openEditor = (label?: ProjectLabelRow) =>
    openModal(({ close }) => (
      <LabelModal
        workspaceId={workspaceId}
        projectId={projectId}
        label={label}
        onDone={() => {
          setError("");
          router.refresh();
        }}
        close={close}
      />
    ));

  const remove = async (row: ProjectLabelRow) => {
    // Ein Label zu löschen nimmt es auch von den Issues, an denen es hängt.
    // Deshalb steht die Zahl in der Rückfrage: sie ist der Unterschied
    // zwischen „aufräumen" und „eine Einteilung verlieren".
    const ok = await confirm({
      title: t("projectLabels.deleteTitle", { name: row.name }),
      description: t("projectLabels.deleteDesc", { count: row.issueCount }),
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

  // Ausblenden ist folgenlos genug für einen Klick ohne Rückfrage: das Label
  // bleibt dem Workspace, die Aufgaben behalten es, und derselbe Knopf holt es
  // zurück. Deshalb hier keine Bestätigung wie beim Löschen.
  const toggleHidden = (row: ProjectLabelRow) =>
    startTransition(async () => {
      const result = await setLabelHidden(projectId, row.id, !row.hidden);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError("");
      router.refresh();
    });

  const newButton = canCreate && (
    <Button
      variant="primary"
      icon={<Icon icon="lucide:plus" width={15} />}
      onClick={() => openEditor()}
    >
      {t("projectLabels.newLabel")}
    </Button>
  );

  // Ein ausgeblendetes Label bleibt lesbar, tritt aber zurück — und sagt es
  // dazu: die blasse Farbe allein wäre für sich genommen keine Auskunft.
  const labelCell = (row: ProjectLabelRow) =>
    row.hidden ? (
      <>
        <span className={styles.hiddenLabel}>
          <Label color={row.color} filled>
            {row.name}
          </Label>
        </span>
        <span className={styles.hiddenNote}>{t("projectLabels.hidden")}</span>
      </>
    ) : (
      <Label color={row.color} filled>
        {row.name}
      </Label>
    );

  const usageCell = (row: ProjectLabelRow) =>
    row.issueCount === 0 ? (
      <span className={styles.unused}>{t("projectLabels.unused")}</span>
    ) : (
      <span className={styles.usage}>
        {t("projectLabels.usage", { count: row.issueCount })}
      </span>
    );

  // Eine Aktionsspalte entsteht nur, wenn es in ihr etwas zu tun gibt — eine
  // leere Spalte wäre ein Versprechen, das die Zeilen nicht einlösen können.
  const columns = (
    actions?: (row: ProjectLabelRow) => React.ReactNode,
  ): TableColumn<ProjectLabelRow>[] => [
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
    ...(actions
      ? [
          {
            id: "actions",
            header: "",
            width: "84px",
            align: "end" as const,
            cell: (row: ProjectLabelRow) => (
              <div className={styles.rowActions}>{actions(row)}</div>
            ),
          },
        ]
      : []),
  ];

  const ownActions = (row: ProjectLabelRow) => (
    <>
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
    </>
  );

  // Das Auge zeigt den Zustand der Zeile: durchgestrichen heißt „ist
  // ausgeblendet", offen heißt „wird angeboten". Was ein Klick daraus macht,
  // steht im Tooltip — und was gilt, auch als Wort neben dem Label.
  const inheritedActions = (row: ProjectLabelRow) => (
    <Button
      variant="ghost"
      size="sm"
      icon={
        <Icon icon={row.hidden ? "lucide:eye-off" : "lucide:eye"} width={15} />
      }
      title={t(row.hidden ? "projectLabels.show" : "projectLabels.hide")}
      aria-label={t(row.hidden ? "projectLabels.show" : "projectLabels.hide")}
      disabled={isPending}
      onClick={() => toggleHidden(row)}
    />
  );

  // Zwei Tabellen, zwei Sortierungen: die eigenen Labels und die geerbten sind
  // getrennte Listen und sollen sich auch getrennt ordnen lassen.
  const ownColumns = columns(canUpdate || canDelete ? ownActions : undefined);
  const inheritedColumns = columns(canUpdate ? inheritedActions : undefined);
  const ownSort = useTableSort(ownColumns);
  const inheritedSort = useTableSort(inheritedColumns);

  return (
    <>
      <PageHeader
        divider={false}
        title={t("nav.labels")}
        count={own.length}
        description={t("projectLabels.subtitle", { project: projectName })}
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
              title={t("projectLabels.emptyTitle")}
              description={t("projectLabels.emptyDesc")}
              action={newButton}
            />
          }
        />

        {inherited.length > 0 && (
          <section className={styles.inherited}>
            <h2 className={styles.groupTitle}>
              {t("projectLabels.inheritedTitle")}
            </h2>

            <Table
              variant="card"
              label={t("projectLabels.inheritedTitle")}
              columns={inheritedColumns}
              rows={inheritedSort.sortRows(inherited)}
              sort={inheritedSort.sort}
              getRowKey={(row) => row.id}
            />
          </section>
        )}
      </div>
    </>
  );
}
