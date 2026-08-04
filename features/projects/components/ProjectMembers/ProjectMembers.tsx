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
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { Table, type TableColumn } from "@/components/ui/layout/Table/Table";
import {
  addProjectMembers,
  removeProjectMember,
  setProjectMemberRole,
} from "@/features/projects/actions";
import type {
  ProjectMemberRow,
  ProjectMembersView,
} from "@/features/projects/types";
import { useModal } from "@/lib/context";
import { roleColor } from "@/lib/rbac";
import { fullName } from "@/lib/utils/string";
import { AddProjectMembersModal } from "./components/AddProjectMembersModal";
import styles from "./projectMembers.module.scss";

interface ProjectMembersProps extends ProjectMembersView {
  projectId: string;
  projectName: string;
}

/**
 * Wer Zugriff auf ein Projekt hat, als eine Liste. Die Spalte „Zugriff" sagt,
 * woher er kommt: eine eigene Projektrolle oder die geerbte Workspace-Rolle.
 * Aus geerbtem Zugriff wird per Klick eine eigene Rolle — geändert wird nur,
 * was dem Projekt selbst gehört.
 */
export function ProjectMembers({
  projectId,
  projectName,
  rows,
  candidates,
  assignableRoles,
  defaultRole,
  canAdd,
  canSetRole,
  canRemove,
  canInvite,
}: ProjectMembersProps) {
  const t = useTranslations();
  const router = useRouter();
  const { openModal } = useModal();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const run = (action: () => Promise<{ ok: true } | { error: string }>) =>
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError("");
      router.refresh();
    });

  const openAdd = () =>
    openModal(({ close }) => (
      <AddProjectMembersModal
        projectId={projectId}
        projectName={projectName}
        candidates={candidates}
        roles={assignableRoles}
        defaultRole={defaultRole}
        canInvite={canInvite}
        close={close}
      />
    ));

  const addButton = canAdd && (
    <Button
      variant="primary"
      icon={<Icon icon="lucide:plus" width={15} />}
      onClick={openAdd}
    >
      {t("actions.addMember")}
    </Button>
  );

  const roleCell = (row: ProjectMemberRow) => {
    const own = row.source === "project";
    // Gefüllt heißt „diese Rolle gehört dem Projekt". Eine geerbte
    // Workspace-Rolle bleibt blass — sie gilt hier, entschieden wurde sie
    // woanders. Das ersetzt die frühere eigene Spalte dafür.
    const pill = (
      <Label
        size="sm"
        filled={own}
        color={roleColor(row.roleRank)}
        title={own ? undefined : t("projectMembers.inherited")}
      >
        {row.roleName}
      </Label>
    );
    // Nur eine eigene Projektrolle lässt sich hier ändern, und nur mit
    // `member.role.update`. Die geerbte gehört dem Workspace — wer sie anfassen
    // will, nimmt die Person erst ins Projekt.
    if (!own || !row.manageable || !canSetRole || assignableRoles.length === 0)
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
        width={220}
        stop
      >
        {(close) => (
          <SelectMenu
            items={assignableRoles.map((role) => ({
              value: role.id,
              label: role.name,
            }))}
            value={row.role}
            onPick={(value) => {
              run(() =>
                setProjectMemberRole(projectId, row.user.id, String(value)),
              );
              close();
            }}
            onClose={close}
          />
        )}
      </InlinePicker>
    );
  };

  // Aktiv ist der Normalfall und bleibt deshalb ruhig; eine offene Einladung
  // ist der Sonderfall und meldet sich mit Farbe und Punkt.
  const statusCell = (row: ProjectMemberRow) =>
    row.pending ? (
      <span className={styles.statusInvited}>
        {t("projectMembers.statusInvited")}
      </span>
    ) : (
      <span className={styles.status}>{t("projectMembers.statusActive")}</span>
    );

  const actionCell = (row: ProjectMemberRow) => {
    if (!row.manageable) return null;

    // Geerbter Zugriff lässt sich nicht entziehen — nur in eine eigene
    // Projektrolle überführen, die man danach ändern kann. Das ist eine Aufnahme
    // ins Projekt und hängt deshalb an `member.invite`.
    if (row.source === "workspace") {
      if (!canAdd) return null;
      const label = t("projectMembers.addToProject");
      return (
        <Button
          variant="ghost"
          size="sm"
          icon={<Icon icon="lucide:user-plus" width={15} />}
          title={label}
          aria-label={label}
          disabled={isPending}
          onClick={() =>
            run(() =>
              addProjectMembers({
                projectId,
                userIds: [row.user.id],
                role: defaultRole,
              }),
            )
          }
        />
      );
    }

    if (!canRemove) return null;

    const label = t("projectMembers.removeFromProject");
    return (
      <Button
        variant="ghost"
        size="sm"
        icon={<Icon icon="lucide:trash-2" width={15} />}
        title={label}
        aria-label={label}
        disabled={isPending}
        onClick={() => run(() => removeProjectMember(projectId, row.user.id))}
      />
    );
  };

  const columns: TableColumn<ProjectMemberRow>[] = [
    {
      id: "member",
      header: t("projectMembers.colMember"),
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
      id: "status",
      header: t("projectMembers.colStatus"),
      width: "minmax(140px, max-content)",
      cell: statusCell,
    },
    {
      id: "actions",
      header: "",
      width: "40px",
      align: "end",
      cell: actionCell,
    },
  ];

  return (
    <>
      <PageHeader
        divider={false}
        title={t("nav.members")}
        description={t("projectMembers.subtitle", {
          count: rows.length,
          project: projectName,
        })}
        actions={addButton}
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
          getRowKey={(row) => `${row.source}:${row.user.id}`}
          empty={
            <EmptyState
              icon={<Icon icon="lucide:users" width={32} />}
              title={t("projectMembers.emptyTitle")}
              description={t("projectMembers.emptyDesc")}
              action={addButton}
            />
          }
        />
      </div>
    </>
  );
}
