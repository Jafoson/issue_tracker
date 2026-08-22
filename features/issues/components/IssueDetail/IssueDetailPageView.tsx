"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import type { IssueComposerData, IssuePatch } from "@/features/issues/types";
import { Link } from "@/i18n/navigation";
import type { PMDoc } from "@/lib/richtext/types";
import type { IssueDetail, Project } from "@/types";
import { IssueAttachments } from "./components/IssueAttachments";
import { IssueComments } from "./components/IssueComments";
import { IssueDescription } from "./components/IssueDescription";
import {
  IssueActionsMenu,
  ShareIssueButton,
} from "./components/IssueDetailActions";
import { IssueSidebar, PAGE_SIDEBAR_W } from "./components/IssueSidebar";
import { IssueTitle } from "./components/IssueTitle";
import styles from "./issueDetail.module.scss";

interface IssueDetailPageViewProps {
  issue: IssueDetail;
  /** Aufgelöst, weil die Kopfzeile es braucht — `null`, wenn es fehlt. */
  project: Project | null;
  data: IssueComposerData;
  /** Ziel des Zurück-Pfeils und der Projekt-Stufe im Pfad. */
  backHref: string;
  onPatch: (patch: IssuePatch) => void;
  onComment: (body: PMDoc) => Promise<void>;
  onDelete: () => void;
  /** Holt das Issue neu — für Anhänge, die am Hook vorbei geschrieben werden. */
  onRefresh: () => Promise<void>;
}

/**
 * Reine Darstellung der Vollseite — alles, was schreibt, kommt als Callback
 * herein.
 *
 * Der Aufbau ist der des großen Dialogs (Inhalt links, Attribute rechts, jede
 * Spalte für sich scrollend), die Kopfzeile ist es nicht: statt Titel und
 * Kreuz steht dort der Pfad, über den man hergekommen ist und wieder
 * zurückkommt. Eine Seite schließt man nicht, man verlässt sie.
 */
export function IssueDetailPageView({
  issue,
  project,
  data,
  backHref,
  onPatch,
  onComment,
  onDelete,
  onRefresh,
}: IssueDetailPageViewProps) {
  const t = useTranslations();
  const identifier = `${project?.prefix ?? "?"}-${issue.key}`;
  const backLabel = project
    ? t("nav.backToProject", { name: project.name })
    : t("nav.backToWorkspace");

  return (
    <article className={styles.page}>
      <header className={styles.pageHeader}>
        <Link
          href={backHref}
          className={styles.back}
          aria-label={backLabel}
          title={backLabel}
        >
          <Icon icon="lucide:arrow-left" width={16} aria-hidden="true" />
        </Link>

        {/* Zwei Stufen genügen: das Projekt, in dem das Issue steckt, und das
            Issue selbst. Der Workspace steht ohnehin in der Seitenleiste. */}
        <nav className={styles.crumbs} aria-label={t("nav.breadcrumb")}>
          <Link href={backHref} className={styles.crumb}>
            <span className="dot" style={{ background: project?.color }} />
            <span className={styles.crumbText}>{project?.name ?? "—"}</span>
          </Link>
          <span className={styles.crumbSep} aria-hidden="true">
            /
          </span>
          <span className={styles.crumbCurrent} aria-current="page">
            {identifier}
          </span>
        </nav>

        <div className={styles.pageActions}>
          {issue.access.canShare && (
            <ShareIssueButton
              issueId={issue.id}
              shareUrl={issue.shareUrl}
              members={data.members}
              me={data.me}
            />
          )}
          {/* Ohne `OpenPageButton` daneben — hier ist die Seite schon. */}
          <IssueActionsMenu
            onDelete={onDelete}
            canDelete={issue.access.canDelete}
          />
        </div>
      </header>

      <div className={styles.split}>
        <div className={styles.main}>
          <IssueTitle
            title={issue.title}
            readOnly={!issue.access.canEdit}
            onPatch={onPatch}
          />
          <IssueDescription
            issueId={issue.id}
            description={issue.description}
            data={data}
            readOnly={!issue.access.canEdit}
            onPatch={onPatch}
            onRefresh={onRefresh}
          />
          <IssueAttachments
            issueId={issue.id}
            attachments={issue.attachments}
            readOnly={!issue.access.canEdit}
            onRefresh={onRefresh}
          />
          <IssueComments
            issueId={issue.id}
            comments={issue.comments}
            members={data.members}
            me={data.me}
            data={data}
            onSubmit={onComment}
            onRefresh={onRefresh}
          />
        </div>

        <IssueSidebar
          issue={issue}
          data={data}
          defaultWidth={PAGE_SIDEBAR_W}
          onPatch={onPatch}
        />
      </div>
    </article>
  );
}
