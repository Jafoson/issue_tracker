"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/atoms/EmptyState/EmptyState";
import { UserCell } from "@/components/ui/atoms/UserCell/UserCell";
import { PageHeader } from "@/components/ui/layout/PageHeader/PageHeader";
import { Table, type TableColumn } from "@/components/ui/layout/Table/Table";
import { useTableSort } from "@/components/ui/layout/Table/useTableSort";
import { NewProjectButton } from "@/features/projects/components/NewProjectButton/NewProjectButton";
import type { ProjectOverviewRow } from "@/features/projects/queries";
import { Link } from "@/i18n/navigation";
import { projectPath } from "@/lib/nav";
import { fullName } from "@/lib/utils/string";
import styles from "./projectOverview.module.scss";

interface Props {
  rows: ProjectOverviewRow[];
  canCreate: boolean;
  workspaceId: string;
}

/**
 * Alle Projekte, die man sehen darf, in einer Liste.
 *
 * Eine Übersicht, keine Verwaltung: eine Tabelle statt zweier Abschnitte nach
 * Sichtbarkeit, und nur die vier Angaben, nach denen man ein Projekt sucht —
 * Name, wofür es da ist, wer es leitet, unter welchem Kürzel seine Aufgaben
 * laufen. Ob es privat ist, spielt hier keine Rolle: was in der Liste steht,
 * darf man ohnehin sehen.
 *
 * Geändert und gelöscht wird eine Ebene weiter, in
 * `features/workspaces/components/WorkspaceProjects` — dort stehen Stift und
 * Papierkorb, dort auch die Zahlen. Die Zeile hier führt einfach ins Projekt.
 */
export function ProjectOverview({ rows, canCreate, workspaceId }: Props) {
  const t = useTranslations();

  const newButton = canCreate && <NewProjectButton workspaceId={workspaceId} />;

  const columns: TableColumn<ProjectOverviewRow>[] = [
    {
      id: "project",
      header: t("fields.project"),
      width: "minmax(160px, max-content)",
      sortValue: (row) => row.name,
      cell: (row) => (
        <span className={styles.project}>
          <span
            className={styles.dot}
            style={{ background: row.color }}
            aria-hidden
          />
          <span className={styles.name}>{row.name}</span>
        </span>
      ),
    },
    {
      id: "desc",
      header: t("fields.description"),
      // Die Beschreibung bekommt den Rest der Breite und wird beschnitten: eine
      // Liste, in der jede Zeile gleich hoch ist, überfliegt sich leichter als
      // eine, in der ein langer Satz drei Zeilen bekommt.
      width: "minmax(0, 1fr)",
      sortValue: (row) => row.desc,
      cell: (row) =>
        row.desc ? (
          <span className={styles.desc} title={row.desc}>
            {row.desc}
          </span>
        ) : null,
    },
    {
      id: "lead",
      header: t("fields.lead"),
      width: "minmax(170px, max-content)",
      // Ohne Leitung nach unten: die Frage der Spalte ist „wer", und „niemand"
      // ist die schwächste Antwort darauf.
      sortValue: (row) => (row.lead ? fullName(row.lead) : "￿"),
      cell: (row) =>
        row.lead ? (
          <UserCell
            avatar={row.lead}
            name={fullName(row.lead)}
            size={26}
            trailing={
              row.moreLeads > 0 && (
                <span className={styles.moreLeads}>+{row.moreLeads}</span>
              )
            }
          />
        ) : (
          <span className={styles.noLead}>{t("projects.noLead")}</span>
        ),
    },
    {
      id: "prefix",
      header: t("fields.prefix"),
      width: "minmax(90px, max-content)",
      align: "end",
      sortValue: (row) => row.prefix,
      cell: (row) => <span className={styles.prefix}>{row.prefix}</span>,
    },
  ];

  const { sort, sortRows } = useTableSort(columns);

  return (
    <>
      <PageHeader
        divider={false}
        title={t("nav.projects")}
        count={rows.length}
        description={t("projects.subtitle")}
        actions={newButton}
      />

      <div className={styles.content}>
        <Table
          variant="card"
          label={t("nav.projects")}
          columns={columns}
          rows={sortRows(rows)}
          sort={sort}
          getRowKey={(row) => row.id}
          // Die Zeile führt ins Projekt — als Link, damit Tastatur, Mittelklick
          // und „in neuem Tab öffnen" mitkommen.
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
