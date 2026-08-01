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
import type { Issue } from "@/types";
import { IssueComments } from "./components/IssueComments";
import { IssueDescription } from "./components/IssueDescription";
import {
  CopyLinkButton,
  IssueActionsMenu,
  OpenPageButton,
} from "./components/IssueDetailActions";
import { IssueLabels } from "./components/IssueLabels";
import { IssueMeta } from "./components/IssueMeta";
import { IssueProperties } from "./components/IssueProperties";
import { IssueSidebar } from "./components/IssueSidebar";
import { IssueTitle } from "./components/IssueTitle";
import styles from "./issueDetail.module.scss";

/**
 * Grenzen des Seitenpanels. Es steht an der rechten Kante und lässt sich am
 * linken Rand breiter ziehen — bis zur Obergrenze, denn ein Panel, das den
 * Bildschirm füllt, ist kein Panel mehr; dafür gibt es das Ausklappen.
 *
 * Die Ausgangsbreite steht hier und nicht im Stylesheet: `.modal.panel` setzt
 * `--modal-w` mit zwei Klassen und schlüge jede Regel, die `.detail` dagegen
 * hält. Inline gewinnt sie ohne Wettrüsten — und der Ladeplatzhalter zeigt
 * denselben Wert, damit das Panel beim Eintreffen der Daten nicht springt.
 */
const PANEL_MIN_W = 480;
const PANEL_MAX_W = 1200;
const PANEL_DEFAULT_W = 720;

/**
 * Die Klassen der Hülle. Ausgeklappt bringt eigene Breite und einen Schatten
 * mit — und weil Ladezustand, Fehlzustand und fertige Ansicht dieselbe Hülle
 * tragen müssen, steht die Liste hier einmal statt dreimal.
 */
function shellClass(isExpanded: boolean) {
  return [styles.detail, isExpanded && styles.expanded]
    .filter(Boolean)
    .join(" ");
}

interface IssueDetailViewProps {
  issue: Issue;
  data: IssueComposerData;
  onClose: () => void;
  /**
   * Klappt zwischen Seitenpanel und großem Dialog um. Fehlt, wo es nichts
   * umzuklappen gibt — auf der Vollseite.
   */
  onToggleExpanded?: () => void;
  isExpanded?: boolean;
  onPatch: (patch: IssuePatch) => void;
  onComment: (body: PMDoc) => Promise<void>;
  onDelete: () => void;
}

/** Reine Darstellung — alles, was schreibt, kommt als Callback herein. */
export function IssueDetailView({
  issue,
  data,
  onClose,
  onToggleExpanded,
  isExpanded = false,
  onPatch,
  onComment,
  onDelete,
}: IssueDetailViewProps) {
  const t = useTranslations();
  const isPanel = !isExpanded;
  // Nur das Panel ist ziehbar — der ausgeklappte Dialog bemisst sich an der
  // Bildschirmbreite.
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
            {/* Panel und Dialog liegen beide über etwas anderem — von hier
                führt der Knopf auf die Seite, die für sich steht. */}
            <OpenPageButton
              workspaceId={data.workspaceId}
              identifier={identifier}
            />
            <CopyLinkButton
              workspaceId={data.workspaceId}
              identifier={identifier}
            />
            <IssueActionsMenu onDelete={onDelete} />
          </>
        }
        onClose={onClose}
        closeLabel={t("actions.close")}
      />

      {/* Das schmale Seitenpanel zeigt alles untereinander, in der Reihenfolge,
          in der man das Issue liest: worum es geht, wie es eingeordnet ist, was
          dazu zu sagen war. Eine zweite Spalte hätte dort nur einen Stapel mit
          Trennlinie ergeben.

          Der große Dialog hat die Breite für zwei Spalten — dort bleibt es wie
          auf der Vollseite beim Inhalt links, Attribute rechts. */}
      {isPanel ? (
        <div className={styles.body}>
          <IssueTitle title={issue.title} onPatch={onPatch} />
          <IssueProperties
            issue={issue}
            data={data}
            layout="column"
            onPatch={onPatch}
          />
          <IssueDescription
            description={issue.description}
            data={data}
            onPatch={onPatch}
          />
          <IssueLabels
            issue={issue}
            data={data}
            layout="column"
            onPatch={onPatch}
          />
          <IssueMeta issue={issue} data={data} layout="column" />
          <IssueComments
            comments={issue.comments}
            members={data.members}
            me={data.me}
            data={data}
            onSubmit={onComment}
          />
        </div>
      ) : (
        <div className={styles.split}>
          <div className={styles.main}>
            <IssueTitle title={issue.title} onPatch={onPatch} />
            <IssueDescription
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
      )}

      {/* Am linken Rand des Panels, absolut über allem. Steht zuletzt im
          Markup, damit er sich beim Tabben nicht vor die Kopfzeile drängt —
          gesehen wird er ohnehin an seiner Kante, nicht an seiner Stelle. */}
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
 * Platzhalter, solange das Issue noch geladen wird. Rendert dieselbe Hülle,
 * damit das Panel beim Eintreffen der Daten nicht die Größe wechselt.
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
 * Ein Link kann auf ein gelöschtes Issue zeigen — dann steht das hier statt
 * eines ewigen Ladezustands.
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
