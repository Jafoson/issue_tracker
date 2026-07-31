"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/atoms/EmptyState/EmptyState";
import { ModalHeader } from "@/components/ui/layout/Modal/components/ModalHeader";
import { Modal } from "@/components/ui/layout/Modal/Modal";
import type { IssueComposerData, IssuePatch } from "@/features/issues/types";
import type { PMDoc } from "@/lib/richtext/types";
import type { Issue } from "@/types";
import { IssueComments } from "./components/IssueComments";
import {
  CopyLinkButton,
  IssueActionsMenu,
} from "./components/IssueDetailActions";
import { IssueSidebar } from "./components/IssueSidebar";
import { IssueSummary } from "./components/IssueSummary";
import styles from "./issueDetail.module.scss";

/**
 * `panel` liegt als Seitenpanel im Modal-Stack über der Liste, `page` ist die
 * eingebettete Vollseite unter `/[workspace]/issue/[ref]`. Beide zeigen
 * dasselbe — nur Hülle und Kopfzeilen-Aktionen unterscheiden sich.
 */
export type IssueDetailVariant = "panel" | "page";

interface IssueDetailViewProps {
  issue: Issue;
  data: IssueComposerData;
  variant: IssueDetailVariant;
  onClose: () => void;
  onPatch: (patch: IssuePatch) => void;
  onComment: (body: PMDoc) => Promise<void>;
  onDelete: () => void;
}

/** Reine Darstellung — alles, was schreibt, kommt als Callback herein. */
export function IssueDetailView({
  issue,
  data,
  variant,
  onClose,
  onPatch,
  onComment,
  onDelete,
}: IssueDetailViewProps) {
  const t = useTranslations();
  const isPanel = variant === "panel";
  const prefix = data.projects.find((p) => p.id === issue.project)?.prefix;
  const identifier = `${prefix ?? "?"}-${issue.key}`;

  return (
    <Modal
      variant={isPanel ? "panel" : "dialog"}
      className={[styles.detail, !isPanel && styles.page]
        .filter(Boolean)
        .join(" ")}
    >
      <ModalHeader
        title={<span className={styles.ref}>{identifier}</span>}
        actions={
          <>
            <CopyLinkButton
              workspaceId={data.workspaceId}
              identifier={identifier}
            />
            <IssueActionsMenu
              workspaceId={data.workspaceId}
              identifier={identifier}
              showFullscreen={isPanel}
              onDelete={onDelete}
            />
          </>
        }
        onClose={onClose}
        closeLabel={t("actions.close")}
      />

      <div className={styles.split}>
        <div className={styles.main}>
          <IssueSummary
            title={issue.title}
            description={issue.description}
            data={data}
            onPatch={onPatch}
          />
          <IssueComments
            comments={issue.comments}
            members={data.members}
            me={data.me}
            data={data}
            onSubmit={onComment}
          />
        </div>

        <IssueSidebar issue={issue} data={data} onPatch={onPatch} />
      </div>
    </Modal>
  );
}

/**
 * Platzhalter, solange das Issue noch geladen wird. Rendert dieselbe Hülle,
 * damit das Panel beim Eintreffen der Daten nicht die Größe wechselt.
 */
export function IssueDetailSkeleton({
  variant,
  onClose,
}: {
  variant: IssueDetailVariant;
  onClose: () => void;
}) {
  const t = useTranslations();
  const isPanel = variant === "panel";

  return (
    <Modal
      variant={isPanel ? "panel" : "dialog"}
      className={[styles.detail, !isPanel && styles.page]
        .filter(Boolean)
        .join(" ")}
      aria-busy="true"
    >
      <ModalHeader
        title={<span className={styles.ref}>…</span>}
        onClose={onClose}
        closeLabel={t("actions.close")}
      />
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
    </Modal>
  );
}

/**
 * Ein Link kann auf ein gelöschtes Issue zeigen — dann steht das hier statt
 * eines ewigen Ladezustands.
 */
export function IssueDetailMissing({
  variant,
  onClose,
}: {
  variant: IssueDetailVariant;
  onClose: () => void;
}) {
  const t = useTranslations();
  const isPanel = variant === "panel";

  return (
    <Modal
      variant={isPanel ? "panel" : "dialog"}
      className={[styles.detail, !isPanel && styles.page]
        .filter(Boolean)
        .join(" ")}
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
