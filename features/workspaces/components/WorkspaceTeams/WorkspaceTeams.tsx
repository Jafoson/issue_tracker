"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { AvatarStack } from "@/components/ui/atoms/Avatar/Avatar";
import { Button } from "@/components/ui/atoms/Button/Button";
import { EmptyState } from "@/components/ui/atoms/EmptyState/EmptyState";
import { Label } from "@/components/ui/atoms/Label/Label";
import { useConfirm } from "@/components/ui/layout/ConfirmDialog/ConfirmDialog";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { Table, type TableColumn } from "@/components/ui/layout/Table/Table";
import { deleteTeam } from "@/features/workspaces/actions";
import type {
  WorkspaceTeamRow,
  WorkspaceTeamsView,
} from "@/features/workspaces/types";
import { useModal } from "@/lib/context";
import { fullName } from "@/lib/utils/string";
import { TeamModal } from "./components/TeamModal";
import styles from "./workspaceTeams.module.scss";

interface Props extends WorkspaceTeamsView {
  workspaceId: string;
}

/**
 * Die Teams des Workspace: wer zusammengehört und woran.
 *
 * Ein Team vergibt keine Rechte — es bündelt Menschen und Projekte, damit man
 * über eine Gruppe sprechen kann statt über sieben Namen. Deshalb steht hier
 * keine Rolle und kein Zugriff, sondern wer dabei ist, was ansteht und wer
 * führt.
 */
export function WorkspaceTeams({
  rows,
  candidates,
  projects,
  canCreate,
  canUpdate,
  canDelete,
  canManageMembers,
  canManageProjects,
  workspaceId,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const confirm = useConfirm();
  const { openModal } = useModal();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  // Anlegen und Ändern führen durch denselben Dialog: es sind dieselben Felder,
  // und ein zweiter Dialog wäre eine zweite Stelle, die man pflegen muss.
  const openEditor = (team?: WorkspaceTeamRow) =>
    openModal(({ close }) => (
      <TeamModal
        workspaceId={workspaceId}
        team={team}
        candidates={candidates}
        projects={projects}
        canManageMembers={canManageMembers}
        canManageProjects={canManageProjects}
        onDone={() => {
          setError("");
          router.refresh();
        }}
        close={close}
      />
    ));

  const remove = async (row: WorkspaceTeamRow) => {
    const ok = await confirm({
      title: t("workspaceTeams.deleteTitle", { name: row.name }),
      description: t("workspaceTeams.deleteDesc", {
        count: row.members.length,
      }),
      confirmLabel: t("actions.delete"),
      cancelLabel: t("actions.cancel"),
      danger: true,
    });
    if (!ok) return;

    startTransition(async () => {
      const result = await deleteTeam(row.id);
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
      {t("actions.newTeam")}
    </Button>
  );

  // Der Dialog ist nur dann ein Angebot, wenn er auch etwas bewirken kann —
  // ohne jedes der drei Rechte bleibt die Zeile eine Auskunft.
  const editable = canUpdate || canManageMembers || canManageProjects;

  const columns: TableColumn<WorkspaceTeamRow>[] = [
    {
      id: "team",
      header: t("workspaceTeams.colTeam"),
      width: "minmax(0, 1fr)",
      cell: (row) => (
        <span className={styles.team}>
          <span
            className={styles.dot}
            style={{ background: row.color }}
            aria-hidden
          />
          <span className={styles.identity}>
            <span className={styles.name}>{row.name}</span>
            <span className={styles.key}>{row.key}</span>
          </span>
        </span>
      ),
    },
    {
      id: "lead",
      header: t("workspaceTeams.colLead"),
      width: "minmax(150px, max-content)",
      cell: (row) => (
        <span className={styles.lead}>
          {row.lead ? fullName(row.lead) : t("fields.none")}
        </span>
      ),
    },
    {
      id: "members",
      header: t("nav.members"),
      width: "minmax(130px, max-content)",
      cell: (row) =>
        row.members.length === 0 ? (
          <span className={styles.empty}>{t("workspaceTeams.noMembers")}</span>
        ) : (
          <AvatarStack
            ids={row.members.map((m) => m.id)}
            users={row.members}
            size={24}
            max={5}
          />
        ),
    },
    {
      id: "projects",
      header: t("nav.projects"),
      width: "minmax(180px, max-content)",
      cell: (row) =>
        row.projects.length === 0 ? (
          <span className={styles.empty}>{t("workspaceTeams.noProjects")}</span>
        ) : (
          <span className={styles.projects}>
            {row.projects.slice(0, 2).map((p) => (
              <Label key={p.id} size="sm" color={p.color}>
                {p.name}
              </Label>
            ))}
            {row.projects.length > 2 && (
              <span className={styles.more}>+{row.projects.length - 2}</span>
            )}
          </span>
        ),
    },
    {
      // Was das Team gerade trägt: offene Aufgaben in seinen Projekten. Die
      // Zahl gehört dem Team nur mittelbar — sie sagt, wie viel dort ansteht.
      id: "open",
      header: t("workspaceTeams.colOpen"),
      width: "minmax(90px, max-content)",
      align: "end",
      cell: (row) => <span className={styles.count}>{row.openIssues}</span>,
    },
    {
      id: "actions",
      header: "",
      width: "84px",
      align: "end",
      cell: (row) => (
        <div className={styles.rowActions}>
          {editable && (
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
  ];

  return (
    <>
      <PageHeader
        divider={false}
        title={t("nav.teams")}
        count={rows.length}
        description={t("workspaceTeams.subtitle")}
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
          label={t("nav.teams")}
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          empty={
            <EmptyState
              icon={<Icon icon="lucide:users-round" width={32} />}
              title={t("workspaceTeams.emptyTitle")}
              description={t("workspaceTeams.emptyDesc")}
              action={newButton}
            />
          }
        />
      </div>
    </>
  );
}
