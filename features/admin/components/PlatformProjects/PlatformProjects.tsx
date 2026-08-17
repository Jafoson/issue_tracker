"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Button } from "@/components/ui/atoms/Button/Button";
import { EmptyState } from "@/components/ui/atoms/EmptyState/EmptyState";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { LoadMoreSentinel } from "@/components/ui/layout/Table/LoadMoreSentinel/LoadMoreSentinel";
import { Table, type TableColumn } from "@/components/ui/layout/Table/Table";
import { useInfiniteScroll } from "@/components/ui/layout/Table/useInfiniteScroll";
import { useTableSort } from "@/components/ui/layout/Table/useTableSort";
import { reassignProject, setProjectArchived } from "@/features/admin/actions";
import type { PlatformProject } from "@/features/admin/queries";
import { useModal } from "@/lib/context";
import { useTimeAgo } from "@/lib/utils/useTimeAgo";
import { BreakGlassModal } from "./components/BreakGlassModal";
import styles from "./platformProjects.module.scss";

/** Ein Konto, dem sich ein verwaistes Projekt zuordnen lässt. */
export interface OwnerOption {
  id: string;
  name: string;
  email: string;
}

interface Props {
  projects: PlatformProject[];
  owners: OwnerOption[];
  canManage: boolean;
  canBreakGlass: boolean;
  nextCursor: string | null;
  /** Lädt die nächste Seite ab einem Cursor (`loadMoreProjects`,
   * `features/admin/actions.ts`). */
  loadMore: (
    cursor: string,
  ) => Promise<{ items: PlatformProject[]; nextCursor: string | null }>;
}

/**
 * Alle Projekte der Plattform — ihre Hülle, nicht ihr Inhalt.
 *
 * Diese Liste zeigt auch private Projekte, und das ist der Punkt: eine
 * Plattformverwaltung muss wissen, *dass* es sie gibt, um verwaiste neu
 * zuzuordnen, Kosten zuzurechnen und aufzuräumen. Was darin steht, zeigt sie
 * nicht — es gibt in dieser Tabelle keine Zeile, keinen Link und keinen
 * Aufklapp-Pfeil, der zu Aufgaben oder Kommentaren führte. Die Spalte „Aufgaben"
 * ist eine Zahl und bleibt eine.
 *
 * Der einzige Weg hinein steht am Zeilenende und heißt, wonach er aussieht:
 * Notfall-Zugriff. Er verlangt eine Begründung, trägt den Handelnden sichtbar in
 * die Mitgliederliste ein und steht danach im Protokoll — siehe
 * `BreakGlassModal` und `features/admin/actions.ts`.
 */
export function PlatformProjects({
  projects,
  owners,
  canManage,
  canBreakGlass,
  nextCursor,
  loadMore,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const timeAgo = useTimeAgo();
  const { openModal } = useModal();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const { items, cursor, loading, sentinelRef } = useInfiniteScroll({
    initialItems: projects,
    initialCursor: nextCursor,
    loadMore,
  });

  const run = (action: () => Promise<{ ok: true } | { error: string }>) =>
    startTransition(async () => {
      const result = await action();
      setError("error" in result ? result.error : "");
      router.refresh();
    });

  const openBreakGlass = (project: PlatformProject) =>
    openModal(({ close }) => (
      <BreakGlassModal project={project} close={close} />
    ));

  const columns: TableColumn<PlatformProject>[] = [
    {
      id: "project",
      header: t("platform.colProject"),
      width: "minmax(0, 1fr)",
      sortValue: (row) => row.name,
      cell: (row) => (
        <span className={styles.project}>
          <span className={styles.dot} style={{ background: row.color }} />
          <span className={styles.projectText}>
            <span className={styles.projectName}>
              {row.name}
              {row.visibility === "private" && (
                <Icon
                  icon="lucide:lock"
                  width={12}
                  className={styles.lock}
                  aria-label={t("platform.private")}
                />
              )}
              {row.archivedAt && (
                <Badge size="sm" mono={false}>
                  {t("platform.archived")}
                </Badge>
              )}
              {row.orphaned && (
                <Badge size="sm" mono={false} className={styles.warnBadge}>
                  {t("platform.orphaned")}
                </Badge>
              )}
            </span>
            <span className={styles.projectMeta}>{row.workspace.name}</span>
          </span>
        </span>
      ),
    },
    {
      id: "owner",
      header: t("platform.colOwner"),
      width: "minmax(170px, max-content)",
      sortValue: (row) =>
        row.owner ? `${row.owner.firstName} ${row.owner.lastName}` : null,
      cell: (row) => {
        const label = row.owner
          ? `${row.owner.firstName} ${row.owner.lastName}`.trim()
          : t("platform.noOwner");

        if (!canManage || owners.length === 0)
          return (
            <span className={row.owner ? styles.muted : styles.warn}>
              {label}
            </span>
          );

        return (
          <InlinePicker
            trigger={
              <button
                type="button"
                className={styles.ownerTrigger}
                title={t("platform.reassign")}
              >
                <span className={row.owner ? undefined : styles.warn}>
                  {label}
                </span>
                <Icon icon="lucide:chevron-down" width={14} />
              </button>
            }
            width={280}
            stop
          >
            {(close) => (
              <SelectMenu
                searchable
                placeholder={t("platform.reassignSearch")}
                items={owners.map((owner) => ({
                  value: owner.id,
                  label: owner.name,
                  hint: owner.email,
                }))}
                value={row.owner?.id ?? null}
                onPick={(value) => {
                  run(() => reassignProject(row.id, String(value)));
                  close();
                }}
                onClose={close}
              />
            )}
          </InlinePicker>
        );
      },
    },
    {
      id: "members",
      header: t("platform.colMembers"),
      width: "minmax(100px, max-content)",
      align: "end",
      sortValue: (row) => row.memberCount,
      cell: (row) => <span className={styles.num}>{row.memberCount}</span>,
    },
    {
      // Eine Zahl, kein Weg hinein. Sie sagt, wie viel in dem Projekt liegt —
      // nicht, was.
      id: "issues",
      header: t("platform.colIssues"),
      width: "minmax(100px, max-content)",
      align: "end",
      sortValue: (row) => row.issueCount,
      cell: (row) => <span className={styles.num}>{row.issueCount}</span>,
    },
    {
      id: "created",
      header: t("platform.colCreated"),
      width: "minmax(120px, max-content)",
      sortValue: (row) => row.createdAt,
      cell: (row) => (
        <span className={styles.muted}>{timeAgo(row.createdAt.getTime())}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      width: "max-content",
      align: "end",
      cell: (row) => (
        <span className={styles.actions}>
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              icon={
                <Icon
                  icon={
                    row.archivedAt ? "lucide:archive-restore" : "lucide:archive"
                  }
                  width={15}
                />
              }
              title={
                row.archivedAt ? t("platform.unarchive") : t("platform.archive")
              }
              aria-label={
                row.archivedAt ? t("platform.unarchive") : t("platform.archive")
              }
              disabled={isPending}
              onClick={() =>
                run(() => setProjectArchived(row.id, !row.archivedAt))
              }
            />
          )}
          {canBreakGlass && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon icon="lucide:siren" width={15} />}
              className={styles.breakGlass}
              title={t("platform.breakGlass")}
              aria-label={t("platform.breakGlass")}
              disabled={isPending}
              onClick={() => openBreakGlass(row)}
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
        title={t("nav.projects")}
        count={items.length}
        description={t("platform.projectsDesc")}
      />

      <div className={styles.content}>
        {error && (
          <p className={styles.error} role="alert">
            <Icon icon="lucide:circle-alert" width={14} />
            {error}
          </p>
        )}

        <Table
          fill
          variant="card"
          label={t("nav.projects")}
          columns={columns}
          rows={sortRows(items)}
          sort={sort}
          getRowKey={(row) => row.id}
          empty={
            <EmptyState
              icon={<Icon icon="lucide:folders" width={32} />}
              title={t("platform.projectsEmpty")}
            />
          }
          footer={
            cursor && <LoadMoreSentinel ref={sentinelRef} loading={loading} />
          }
        />
      </div>
    </>
  );
}
