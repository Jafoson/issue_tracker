"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Button } from "@/components/ui/atoms/Button/Button";
import { EmptyState } from "@/components/ui/atoms/EmptyState/EmptyState";
import { useConfirm } from "@/components/ui/layout/ConfirmDialog/ConfirmDialog";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { Table, type TableColumn } from "@/components/ui/layout/Table/Table";
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
 */
export function WorkspaceProjects({ rows, canCreate, workspaceId }: Props) {
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
    {
      id: "visibility",
      header: t("projectSettings.visibility"),
      width: "minmax(110px, max-content)",
      cell: (row) => (
        <Badge mono={false}>
          {row.visibility === "public"
            ? t("projectSettings.public")
            : t("projectSettings.private")}
        </Badge>
      ),
    },
    {
      id: "members",
      header: t("nav.members"),
      width: "minmax(90px, max-content)",
      align: "end",
      cell: (row) => <span className={styles.count}>{row.memberCount}</span>,
    },
    {
      id: "issues",
      header: t("nav.issues"),
      width: "minmax(90px, max-content)",
      align: "end",
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

        <Table
          variant="card"
          label={t("nav.projects")}
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          // Die ganze Zeile führt ins Projekt — als Link, damit Tastatur,
          // Mittelklick und „in neuem Tab öffnen" mitkommen.
          rowOverlay={(row) => (
            <Link
              href={projectPath(workspaceId, row.slug, "")}
              aria-label={row.name}
            />
          )}
          empty={
            <EmptyState
              icon={<Icon icon="lucide:folders" width={32} />}
              title={t("workspaceProjects.emptyTitle")}
              description={t("workspaceProjects.emptyDesc")}
              action={newButton}
            />
          }
        />
      </div>
    </>
  );
}
