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
  /** Resolved because the header needs it — `null` if it's missing. */
  project: Project | null;
  data: IssueComposerData;
  /** Target of the back arrow and the project step in the breadcrumb path. */
  backHref: string;
  onPatch: (patch: IssuePatch) => void;
  onComment: (body: PMDoc) => Promise<void>;
  onDelete: () => void;
  /** Refetches the issue — for attachments that are written past the hook. */
  onRefresh: () => Promise<void>;
}

/**
 * Pure rendering of the full page — everything that writes comes in as a
 * callback.
 *
 * The layout matches the large dialog's (content on the left, attributes on
 * the right, each column scrolling on its own), the header doesn't: instead
 * of a title and a cross, it shows the breadcrumb path that led here and
 * leads back. A page isn't closed, it's left.
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

        {/* Two steps are enough: the project the issue lives in, and the
            issue itself. The workspace is already shown in the sidebar. */}
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
          {/* No `OpenPageButton` next to it — this already is the page. */}
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
            workspaceId={data.workspaceId}
            identifier={identifier}
            comments={issue.comments}
            members={data.members}
            me={data.me}
            data={data}
            canUpdateAnyComment={issue.access.canUpdateAnyComment}
            canDeleteAnyComment={issue.access.canDeleteAnyComment}
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
