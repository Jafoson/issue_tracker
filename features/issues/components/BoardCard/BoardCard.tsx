"use client";

import { Icon } from "@iconify/react";
import { Label } from "@/components/ui/atoms/Label/Label";
import { AssigneePicker } from "@/features/issues/components/AssigneePicker/AssigneePicker";
import {
  PriorityIcon,
  TypeIcon,
} from "@/features/issues/components/IssueIcons/IssueIcons";
import { isBrowserClick } from "@/features/issues/issue-links";
import type { IssueLookups } from "@/features/issues/types";
import { onActivate } from "@/lib/a11y";
import { useTimeAgo } from "@/lib/utils/useTimeAgo";
import type { Issue, Label as LabelType } from "@/types";
import styles from "./boardCard.module.scss";

interface BoardCardProps {
  issue: Issue;
  projectId: string;
  lookups: IssueLookups;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  /** Der gewöhnliche Klick: Panel über dem Board. */
  onOpen?: () => void;
  /**
   * Strg/Cmd- und Mittelklick: die Vollseite in einem neuen Tab.
   *
   * Die Karte ist kein Link — sie ist ziehbar, und ein Anker darüber würde
   * beim Ziehen den Link mitnehmen statt die Karte. Also fragt sie die Taste
   * selbst ab, statt es dem Browser zu überlassen.
   */
  onOpenInNewTab?: () => void;
}

export function BoardCard({
  issue,
  projectId,
  lookups: { members, projects, labels, issueTypes },
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onOpen,
  onOpenInNewTab,
}: BoardCardProps) {
  const timeAgo = useTimeAgo();
  const project = projects.find((p) => p.id === issue.project) ??
    projects.find((p) => p.id === projectId) ?? {
      prefix: "?",
      name: "?",
      color: "#686d76",
    };
  const identifier = `${project.prefix}-${issue.key}`;
  const typeLabel = issue.type
    ? issue.type.charAt(0).toUpperCase() + issue.type.slice(1)
    : null;
  const typeColor = issue.type
    ? (issueTypes.find((x) => x.id === issue.type)?.color ?? "#686d76")
    : null;
  const issueLabels = issue.labels
    .slice(0, 3)
    .map((lid) => labels.find((x) => x.id === lid) ?? null)
    .filter((l): l is LabelType => l !== null);

  return (
    // biome-ignore lint/a11y/useSemanticElements: card contains block-level content; a <button> would be invalid HTML
    <div
      className={`${styles.card}${isDragging ? ` ${styles.dragging}` : ""}`}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onClick={(e) => (isBrowserClick(e) ? onOpenInNewTab?.() : onOpen?.())}
      // Die mittlere Maustaste meldet sich nicht über `onClick`. Ohne
      // `preventDefault` schaltet sie außerdem den Auto-Scroll ein.
      onAuxClick={(e) => {
        if (e.button !== 1) return;
        e.preventDefault();
        onOpenInNewTab?.();
      }}
      onKeyDown={onActivate(() => onOpen?.())}
    >
      {/* Kopfzeile: Typ-Badge + Assignee. Der Avatar ist zugleich der Auslöser
        für die Zuweisung — sie zu ändern, ist der häufigste Griff an einer
        Karte, und dafür soll sie sich nicht erst öffnen müssen. */}
      <div className={styles.header}>
        {typeLabel && typeColor && (
          <Label color={typeColor} filled hasIcon size="xs">
            <TypeIcon type={issue.type} size={10} color={typeColor} />
            {typeLabel}
          </Label>
        )}
        <AssigneePicker issue={issue} members={members} size={30} />
      </div>

      <p className={styles.title}>{issue.title}</p>

      {issueLabels.length > 0 && (
        <div className={styles.labels}>
          {issueLabels.map((l) => (
            <Label key={l.id} color={l.color} size="xs">
              {l.name}
            </Label>
          ))}
        </div>
      )}

      {/* Meta: Priorität + Identifier | Zeit + Kommentare */}
      <div className={styles.footer}>
        <PriorityIcon priority={issue.priority} size={14} />
        <span className={styles.id}>{identifier}</span>
        <span className={styles.time}>{timeAgo(issue.updated)}</span>
        {issue.comments.length > 0 && (
          <span className={styles.comments}>
            <Icon icon="lucide:message-square" width={12} aria-hidden="true" />
            {issue.comments.length}
          </span>
        )}
      </div>
    </div>
  );
}
