"use client";

import { Icon } from "@iconify/react";
import { useFormatter, useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import type { IssueComposerData } from "@/features/issues/types";
import { fullName } from "@/lib/utils/string";
import { useTimeAgo } from "@/lib/utils/useTimeAgo";
import type { Issue } from "@/types";
import styles from "../issueDetail.module.scss";
import type { IssueDetailLayout } from "../types";

interface IssueMetaProps {
  issue: Issue;
  data: IssueComposerData;
  layout: IssueDetailLayout;
}

/** Beschriftete Zeile: Name links, Wert rechts. */
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <div className={styles.rowValue}>{children}</div>
    </div>
  );
}

/**
 * Herkunft und Zeitstempel des Issues. Nur Anzeige — Projekt und Ersteller
 * stehen fest, die Zeiten schreibt der Server.
 *
 * In der Spalte bekommt der Block deshalb einen eigenen Abschnittskopf und
 * steht unten, nach allem, was man tatsächlich anfasst. In der Attributspalte
 * schließt er sie ohne Überschrift ab — dort trennt schon die Linie darüber.
 */
export function IssueMeta({ issue, data, layout }: IssueMetaProps) {
  const { members, projects } = data;
  const t = useTranslations();
  const format = useFormatter();
  const timeAgo = useTimeAgo();

  const project = projects.find((p) => p.id === issue.project);
  const reporter = members.find((m) => m.id === issue.reporter) ?? null;

  const rows = (
    <>
      <Row label={t("fields.project")}>
        <span className={styles.value}>
          <span className="dot" style={{ background: project?.color }} />
          <span className={styles.valueText}>{project?.name ?? "—"}</span>
        </span>
      </Row>

      <Row label={t("fields.creator")}>
        <span className={styles.value}>
          <Avatar avatar={reporter} size={20} placeholder />
          <span className={styles.valueText}>
            {reporter ? fullName(reporter) : "—"}
          </span>
        </span>
      </Row>

      <Row label={t("fields.created")}>
        <span className={`${styles.value} ${styles.valueMuted}`}>
          {format.dateTime(issue.created, {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
      </Row>

      <Row label={t("fields.updated")}>
        <span
          className={`${styles.value} ${styles.valueMuted}`}
          title={format.dateTime(issue.updated, {
            dateStyle: "long",
            timeStyle: "short",
          })}
        >
          {timeAgo(issue.updated)}
        </span>
      </Row>
    </>
  );

  if (layout === "aside") return rows;

  return (
    <section className={styles.section}>
      <header className={styles.sectionHead}>
        <Icon icon="lucide:info" width={15} aria-hidden="true" />
        <h3 className={styles.sectionTitle}>{t("fields.details")}</h3>
      </header>
      <div className={styles.metaGrid}>{rows}</div>
    </section>
  );
}
