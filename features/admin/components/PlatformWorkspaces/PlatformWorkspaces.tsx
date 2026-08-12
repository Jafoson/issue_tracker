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
import { useTableSort } from "@/components/ui/layout/Table/useTableSort";
import { setWorkspaceSuspended } from "@/features/admin/actions";
import type { PlatformWorkspace } from "@/features/admin/queries";
import { useModal } from "@/lib/context";
import { useTimeAgo } from "@/lib/utils/useTimeAgo";
import { DeleteWorkspaceModal } from "./components/DeleteWorkspaceModal";
import styles from "./platformWorkspaces.module.scss";

interface Props {
  workspaces: PlatformWorkspace[];
  canSuspend: boolean;
  canDelete: boolean;
}

/**
 * Die Mandanten der Plattform.
 *
 * ── Was hier steht ──
 *
 * Name, Verantwortlicher, Größe, Alter, letzte Regung, Zustand. Das ist die
 * Hülle: genug, um einen Mandanten zu betreuen, abzurechnen und stillzulegen.
 *
 * ── Was hier fehlt, und warum ──
 *
 * Es gibt keinen Weg hinein. Keine Zeile ist ein Link, kein Knopf heißt
 * „öffnen". Ein Plattform-Admin ist in einem fremden Workspace kein Mitglied,
 * und die Rechteauflösung gibt ihm dort auch nichts (`lib/permissions.ts`) — ein
 * Link führte also nur auf eine leere Seite und weckte den Eindruck, es gäbe
 * eine Tür. Die gibt es, aber woanders und schmaler: den Notfall-Zugriff je
 * Projekt, mit Begründung und Protokoll.
 *
 * ── Was man tun darf ──
 *
 * Sperren ist der Regelfall und umkehrbar: es nimmt allen im Mandanten den
 * Zugang und lässt die Daten stehen. Löschen ist die Ausnahme und endgültig —
 * deshalb steht der Knopf nur an einem bereits gesperrten Workspace zur
 * Verfügung. Wer löschen will, sperrt also zuerst; das ist die Nacht darüber,
 * die keine Bestätigungsabfrage ersetzt.
 */
export function PlatformWorkspaces({
  workspaces,
  canSuspend,
  canDelete,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const confirm = useConfirm();
  const timeAgo = useTimeAgo();
  const { openModal } = useModal();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const run = (action: () => Promise<{ ok: true } | { error: string }>) =>
    startTransition(async () => {
      const result = await action();
      setError("error" in result ? result.error : "");
      router.refresh();
    });

  const toggleSuspended = async (row: PlatformWorkspace) => {
    // Nur das Sperren fragt nach. Das Entsperren gibt etwas zurück, was vorher
    // da war — dafür braucht es keine Rückfrage.
    if (!row.suspended) {
      const ok = await confirm({
        title: t("platformWorkspaces.suspendTitle", { name: row.name }),
        description: t("platformWorkspaces.suspendDesc", {
          members: row.members,
        }),
        confirmLabel: t("platformWorkspaces.suspend"),
        cancelLabel: t("actions.cancel"),
        danger: true,
      });
      if (!ok) return;
    }

    run(() => setWorkspaceSuspended(row.id, !row.suspended));
  };

  const openDelete = (row: PlatformWorkspace) =>
    openModal(({ close }) => (
      <DeleteWorkspaceModal workspace={row} close={close} />
    ));

  const columns: TableColumn<PlatformWorkspace>[] = [
    {
      id: "workspace",
      header: t("platformWorkspaces.colWorkspace"),
      width: "minmax(0, 1fr)",
      sortValue: (row) => row.name,
      cell: (row) => (
        <span className={styles.workspace}>
          <span className={styles.dot} style={{ background: row.color }} />
          <span className={styles.text}>
            <span className={styles.name}>
              {row.name}
              {row.suspended && (
                <Badge size="sm" mono={false} className={styles.suspended}>
                  {t("platformWorkspaces.statusSuspended")}
                </Badge>
              )}
            </span>
            <span className={styles.meta}>{row.slug}</span>
          </span>
        </span>
      ),
    },
    {
      id: "owner",
      header: t("platformWorkspaces.colOwner"),
      width: "minmax(170px, max-content)",
      sortValue: (row) =>
        row.owner ? `${row.owner.firstName} ${row.owner.lastName}` : null,
      cell: (row) =>
        row.owner ? (
          <span className={styles.owner}>
            {`${row.owner.firstName} ${row.owner.lastName}`.trim()}
          </span>
        ) : (
          // Ohne Owner verwaltet den Mandanten niemand mehr — dieselbe Lage wie
          // bei einem verwaisten Projekt, nur eine Ebene höher.
          <span className={styles.warn}>{t("platformWorkspaces.noOwner")}</span>
        ),
    },
    {
      id: "members",
      header: t("platformWorkspaces.colMembers"),
      width: "minmax(100px, max-content)",
      align: "end",
      sortValue: (row) => row.members,
      cell: (row) => <span className={styles.num}>{row.members}</span>,
    },
    {
      id: "projects",
      header: t("platform.projects"),
      width: "minmax(100px, max-content)",
      align: "end",
      sortValue: (row) => row.projects,
      cell: (row) => <span className={styles.num}>{row.projects}</span>,
    },
    {
      // Eine Zahl, kein Weg hinein.
      id: "issues",
      header: t("dashboard.issues"),
      width: "minmax(100px, max-content)",
      align: "end",
      sortValue: (row) => row.issues,
      cell: (row) => <span className={styles.num}>{row.issues}</span>,
    },
    {
      id: "activity",
      header: t("platformWorkspaces.colActivity"),
      width: "minmax(130px, max-content)",
      sortValue: (row) => row.lastActivityAt,
      cell: (row) => (
        <span className={styles.muted}>
          {row.lastActivityAt
            ? timeAgo(row.lastActivityAt.getTime())
            : t("platformWorkspaces.never")}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      width: "max-content",
      align: "end",
      cell: (row) => (
        <span className={styles.actions}>
          {canSuspend && (
            <Button
              variant="ghost"
              size="sm"
              icon={
                <Icon
                  icon={row.suspended ? "lucide:circle-check" : "lucide:ban"}
                  width={15}
                />
              }
              title={
                row.suspended
                  ? t("platformWorkspaces.unsuspend")
                  : t("platformWorkspaces.suspend")
              }
              aria-label={
                row.suspended
                  ? t("platformWorkspaces.unsuspend")
                  : t("platformWorkspaces.suspend")
              }
              disabled={isPending}
              onClick={() => toggleSuspended(row)}
            />
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className={styles.delete}
              icon={<Icon icon="lucide:trash-2" width={15} />}
              // Gesperrt, solange der Mandant läuft. Der Titel sagt, warum —
              // ein abgeblendeter Knopf ohne Begründung ist eine Sackgasse.
              disabled={isPending || !row.suspended}
              title={
                row.suspended
                  ? t("platformWorkspaces.delete")
                  : t("platformWorkspaces.deleteNeedsSuspend")
              }
              aria-label={
                row.suspended
                  ? t("platformWorkspaces.delete")
                  : t("platformWorkspaces.deleteNeedsSuspend")
              }
              onClick={() => openDelete(row)}
            />
          )}
        </span>
      ),
    },
  ];

  const { sort, sortRows } = useTableSort(columns);

  return (
    <>
      <PageHeader
        divider={false}
        title={t("nav.workspaces")}
        count={workspaces.length}
        description={t("platformWorkspaces.desc")}
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
          label={t("nav.workspaces")}
          columns={columns}
          rows={sortRows(workspaces)}
          sort={sort}
          getRowKey={(row) => row.id}
          empty={
            <EmptyState
              icon={<Icon icon="lucide:building-2" width={32} />}
              title={t("platformWorkspaces.empty")}
            />
          }
        />
      </div>
    </>
  );
}
