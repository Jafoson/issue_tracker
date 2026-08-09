"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { EmptyState } from "@/components/ui/atoms/EmptyState/EmptyState";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { Label } from "@/components/ui/atoms/Label/Label";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { UserCell } from "@/components/ui/atoms/UserCell/UserCell";
import { useConfirm } from "@/components/ui/layout/ConfirmDialog/ConfirmDialog";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { Table, type TableColumn } from "@/components/ui/layout/Table/Table";
import { removeMember, setMemberRole } from "@/features/workspaces/actions";
import type {
  WorkspaceMemberRow,
  WorkspaceMembersView,
} from "@/features/workspaces/types";
import { useModal } from "@/lib/context";
import { roleColor } from "@/lib/rbac";
import { fullName } from "@/lib/utils/string";
import { InviteMemberModal } from "./components/InviteMemberModal";
import styles from "./workspaceMembers.module.scss";

interface Props extends WorkspaceMembersView {
  workspaceId: string;
}

/**
 * Wer im Workspace ist, mit welcher Rolle und in welchen Teams.
 *
 * Das Gegenstück zu `ProjectMembers` eine Ebene höher: dort entscheidet die
 * Projektrolle über ein Projekt, hier die Workspace-Rolle über die Hülle, in
 * der alle Projekte liegen. Was sich anfassen lässt, sagt der Server je Zeile
 * (`manageable`) — Rang und Owner-Schutz gehören nicht in den Client.
 */
export function WorkspaceMembers({
  rows,
  assignableRoles,
  canInvite,
  canSetRole,
  canRemove,
  workspaceId,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const confirm = useConfirm();
  const { openModal } = useModal();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  // `setMemberRole` und `removeMember` werfen, statt Fehler zurückzugeben —
  // sie hängen an Zeilenaktionen. Hier wird der Wurf abgefangen, damit die
  // Seite nicht in ihre Fehlergrenze läuft.
  const run = (action: () => Promise<unknown>, failure: string) =>
    startTransition(async () => {
      try {
        await action();
        setError("");
        router.refresh();
      } catch {
        setError(failure);
      }
    });

  const openInvite = () =>
    openModal(({ close }) => (
      <InviteMemberModal
        workspaceId={workspaceId}
        roles={assignableRoles}
        close={close}
      />
    ));

  const remove = async (row: WorkspaceMemberRow) => {
    // Jemanden aus dem Workspace zu nehmen nimmt ihn aus allen seinen
    // Projekten. Das steht in der Rückfrage, weil es der eigentliche Vorgang ist.
    const ok = await confirm({
      title: t("workspaceMembers.removeTitle", { name: fullName(row.user) }),
      description: t("workspaceMembers.removeDesc"),
      confirmLabel: t("actions.remove"),
      cancelLabel: t("actions.cancel"),
      danger: true,
    });
    if (!ok) return;

    run(
      () => removeMember(workspaceId, row.user.id),
      t("workspaceMembers.removeFailed"),
    );
  };

  const inviteButton = canInvite && assignableRoles.length > 0 && (
    <Button
      variant="primary"
      icon={<Icon icon="lucide:plus" width={15} />}
      onClick={openInvite}
    >
      {t("actions.inviteMember")}
    </Button>
  );

  const roleCell = (row: WorkspaceMemberRow) => {
    const pill = (
      <Label size="sm" filled color={roleColor(row.roleRank)}>
        {row.roleName}
      </Label>
    );
    if (!row.manageable || !canSetRole || assignableRoles.length === 0)
      return pill;

    return (
      <InlinePicker
        trigger={
          <button
            type="button"
            className={styles.roleTrigger}
            title={t("fields.role")}
          >
            {pill}
            <Icon icon="lucide:chevron-down" width={14} />
          </button>
        }
        width={240}
        stop
      >
        {(close) => (
          <SelectMenu
            items={assignableRoles.map((role) => ({
              value: role.id,
              label: role.name,
              hint: role.desc,
            }))}
            value={row.role}
            onPick={(value) => {
              run(
                () => setMemberRole(workspaceId, row.user.id, String(value)),
                t("workspaceMembers.roleFailed"),
              );
              close();
            }}
            onClose={close}
          />
        )}
      </InlinePicker>
    );
  };

  const columns: TableColumn<WorkspaceMemberRow>[] = [
    {
      id: "member",
      header: t("members.colUser"),
      width: "minmax(0, 1fr)",
      cell: (row) => (
        <UserCell
          avatar={row.user}
          name={fullName(row.user)}
          meta={row.user.email}
          size={32}
          trailing={
            row.you && (
              <span className={styles.you}>{t("projectMembers.you")}</span>
            )
          }
        />
      ),
    },
    {
      id: "role",
      header: t("fields.role"),
      width: "minmax(150px, max-content)",
      cell: roleCell,
    },
    {
      id: "teams",
      header: t("members.colTeams"),
      width: "minmax(160px, max-content)",
      cell: (row) =>
        row.teams.length === 0 ? (
          <span className={styles.noTeams}>{t("members.noTeams")}</span>
        ) : (
          <span className={styles.teams}>
            {row.teams.map((team) => (
              <Label key={team.id} size="sm" color={team.color}>
                {team.name}
              </Label>
            ))}
          </span>
        ),
    },
    {
      id: "status",
      header: t("projectMembers.colStatus"),
      width: "minmax(130px, max-content)",
      cell: (row) =>
        row.pending ? (
          <span className={styles.statusInvited}>
            {t("projectMembers.statusInvited")}
          </span>
        ) : (
          <span className={styles.status}>
            {t("projectMembers.statusActive")}
          </span>
        ),
    },
    {
      id: "actions",
      header: "",
      width: "40px",
      align: "end",
      cell: (row) =>
        row.manageable &&
        canRemove && (
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon icon="lucide:user-minus" width={15} />}
            title={t("members.removeTitle")}
            aria-label={t("members.removeTitle")}
            disabled={isPending}
            onClick={() => remove(row)}
          />
        ),
    },
  ];

  return (
    <>
      <PageHeader
        divider={false}
        title={t("nav.members")}
        count={rows.length}
        description={t("workspaceMembers.subtitle")}
        actions={inviteButton}
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
          label={t("nav.members")}
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.user.id}
          empty={
            <EmptyState
              icon={<Icon icon="lucide:users" width={32} />}
              title={t("workspaceMembers.emptyTitle")}
              description={t("workspaceMembers.emptyDesc")}
              action={inviteButton}
            />
          }
        />
      </div>
    </>
  );
}
