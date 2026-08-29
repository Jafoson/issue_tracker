"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { EmptyState } from "@/components/ui/atoms/EmptyState/EmptyState";
import { ModalHeader } from "@/components/ui/layout/Modal/components/ModalHeader";
import { Modal } from "@/components/ui/layout/Modal/Modal";
import { Resizer } from "@/components/ui/layout/Resizer/Resizer";
import type { IssueComposerData, IssuePatch } from "@/features/issues/types";
import type { PMDoc } from "@/lib/richtext/types";
import type { IssueDetail } from "@/types";
import { IssueAttachments } from "./components/IssueAttachments";
import { IssueComments } from "./components/IssueComments";
import { IssueDescription } from "./components/IssueDescription";
import {
  IssueActionsMenu,
  OpenPageButton,
  ShareIssueButton,
} from "./components/IssueDetailActions";
import { IssueLabels } from "./components/IssueLabels";
import { IssueMeta } from "./components/IssueMeta";
import { IssueProperties } from "./components/IssueProperties";
import { IssueSidebar } from "./components/IssueSidebar";
import { IssueTitle } from "./components/IssueTitle";
import styles from "./issueDetail.module.scss";

/**
 * Bounds of the side panel. It sits at the right edge and can be dragged
 * wider from its left edge — up to a cap, because a panel that fills the
 * screen is no longer a panel; that's what expanding is for.
 *
 * The starting width lives here rather than in the stylesheet:
 * `.modal.panel` sets `--modal-w` with two classes and would win against
 * any rule `.detail` holds against it. Inline wins without an arms race —
 * and the loading placeholder shows the same value, so the panel doesn't
 * jump when the data arrives.
 */
const PANEL_MIN_W = 480;
const PANEL_MAX_W = 1200;
const PANEL_DEFAULT_W = 720;

/**
 * The shell's classes. Expanded brings its own width and a shadow — and
 * since the loading state, error state, and finished view all need to
 * carry the same shell, the list lives here once instead of three times.
 */
function shellClass(isExpanded: boolean) {
  return [styles.detail, isExpanded && styles.expanded]
    .filter(Boolean)
    .join(" ");
}

interface IssueDetailViewProps {
  issue: IssueDetail;
  data: IssueComposerData;
  onClose: () => void;
  /**
   * Toggles between side panel and large dialog. Missing wherever there's
   * nothing to toggle — on the full page.
   */
  onToggleExpanded?: () => void;
  isExpanded?: boolean;
  onPatch: (patch: IssuePatch) => void;
  onComment: (body: PMDoc) => Promise<void>;
  onDelete: () => void;
  /** Refetches the issue — for attachments that are written past the hook. */
  onRefresh: () => Promise<void>;
}

/** Pure rendering — everything that writes comes in as a callback. */
export function IssueDetailView({
  issue,
  data,
  onClose,
  onToggleExpanded,
  isExpanded = false,
  onPatch,
  onComment,
  onDelete,
  onRefresh,
}: IssueDetailViewProps) {
  const t = useTranslations();
  const isPanel = !isExpanded;
  // Only the panel is resizable — the expanded dialog scales with the
  // screen width.
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT_W);
  const prefix = data.projects.find((p) => p.id === issue.project)?.prefix;
  const identifier = `${prefix ?? "?"}-${issue.key}`;

  return (
    <Modal
      variant={isPanel ? "panel" : "dialog"}
      width={isPanel ? panelWidth : undefined}
      className={shellClass(isExpanded)}
    >
      <ModalHeader
        title={<span className={styles.ref}>{identifier}</span>}
        actions={
          <>
            {onToggleExpanded && (
              <Button
                variant="ghost"
                size="sm"
                icon={
                  <Icon
                    icon={
                      isExpanded ? "lucide:minimize-2" : "lucide:maximize-2"
                    }
                    width={15}
                  />
                }
                aria-label={t(
                  isExpanded ? "actions.collapse" : "actions.expand",
                )}
                title={t(isExpanded ? "actions.collapse" : "actions.expand")}
                onClick={onToggleExpanded}
              />
            )}
            {/* Both the panel and the dialog sit over something else — from
                here, the button leads to the page that stands on its own. */}
            <OpenPageButton
              workspaceId={data.workspaceId}
              identifier={identifier}
            />
            {issue.access.canShare && (
              <ShareIssueButton
                issueId={issue.id}
                shareUrl={issue.shareUrl}
                members={data.members}
                me={data.me}
              />
            )}
            <IssueActionsMenu
              onDelete={onDelete}
              canDelete={issue.access.canDelete}
            />
          </>
        }
        onClose={onClose}
        closeLabel={t("actions.close")}
      />

      {/* The narrow side panel shows everything stacked, in the order you'd
          read the issue: what it's about, how it's categorized, what was
          said about it. A second column there would just have produced a
          stack with a divider line.

          The large dialog has the width for two columns — there, just like
          on the full page, it stays content on the left, attributes on the
          right. */}
      {isPanel ? (
        <div className={styles.body}>
          <IssueTitle
            title={issue.title}
            readOnly={!issue.access.canEdit}
            onPatch={onPatch}
          />
          <IssueProperties
            issue={issue}
            data={data}
            layout="column"
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
          <IssueLabels
            issue={issue}
            data={data}
            layout="column"
            onPatch={onPatch}
          />
          <IssueMeta issue={issue} data={data} layout="column" />
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
      ) : (
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

          <IssueSidebar issue={issue} data={data} onPatch={onPatch} />
        </div>
      )}

      {/* At the panel's left edge, absolutely positioned above everything.
          Placed last in the markup, so it doesn't jump ahead of the header
          when tabbing — it's seen at its edge anyway, not at its position
          in the markup. */}
      {isPanel && (
        <Resizer
          className={styles.panelResizer}
          width={panelWidth}
          onChange={setPanelWidth}
          min={PANEL_MIN_W}
          max={PANEL_MAX_W}
          reset={PANEL_DEFAULT_W}
          label={t("actions.resizePanel")}
        />
      )}
    </Modal>
  );
}

/**
 * Placeholder while the issue is still loading. Renders the same shell, so
 * the panel doesn't change size once the data arrives.
 */
export function IssueDetailSkeleton({
  isExpanded = false,
  onClose,
}: {
  isExpanded?: boolean;
  onClose: () => void;
}) {
  const t = useTranslations();
  const isPanel = !isExpanded;

  return (
    <Modal
      variant={isPanel ? "panel" : "dialog"}
      width={isPanel ? PANEL_DEFAULT_W : undefined}
      className={shellClass(isExpanded)}
      aria-busy="true"
    >
      <ModalHeader
        title={<span className={styles.ref}>…</span>}
        onClose={onClose}
        closeLabel={t("actions.close")}
      />
      {isPanel ? (
        <div className={styles.body}>
          <div className={`${styles.shimmer} ${styles.shimmerTitle}`} />
          <div className={`${styles.shimmer} ${styles.shimmerBox}`} />
          <div className={styles.shimmer} />
          <div className={styles.shimmer} />
          <div className={`${styles.shimmer} ${styles.shimmerShort}`} />
        </div>
      ) : (
        <div className={styles.split}>
          <div className={styles.main}>
            <div className={`${styles.shimmer} ${styles.shimmerTitle}`} />
            <div className={styles.shimmer} />
            <div className={`${styles.shimmer} ${styles.shimmerShort}`} />
          </div>
          <aside className={styles.sidebar}>
            <div className={styles.shimmer} />
            <div className={styles.shimmer} />
            <div className={styles.shimmer} />
          </aside>
        </div>
      )}
    </Modal>
  );
}

/**
 * A link can point to a deleted issue — this is shown then instead of an
 * eternal loading state.
 */
export function IssueDetailMissing({
  isExpanded = false,
  onClose,
}: {
  isExpanded?: boolean;
  onClose: () => void;
}) {
  const t = useTranslations();
  const isPanel = !isExpanded;

  return (
    <Modal
      variant={isPanel ? "panel" : "dialog"}
      width={isPanel ? PANEL_DEFAULT_W : undefined}
      className={shellClass(isExpanded)}
    >
      <ModalHeader
        title={<span className={styles.ref}>—</span>}
        onClose={onClose}
        closeLabel={t("actions.close")}
      />
      <div className={styles.missing}>
        <EmptyState
          icon={<Icon icon="lucide:file-question" width={32} />}
          title={t("empty.issueNotFound")}
          description={t("empty.issueNotFoundHint")}
        />
      </div>
    </Modal>
  );
}
