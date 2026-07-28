"use client";

import { Icon } from "@iconify/react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Label } from "@/components/ui/atoms/Label/Label";
import {
  PriorityIcon,
  TypeIcon,
} from "@/features/issues/components/IssueIcons/IssueIcons";
import { onActivate } from "@/lib/a11y";
import { useTimeAgo } from "@/lib/utils/useTimeAgo";
import { useWorkspace } from "@/lib/workspace-context";
import type { Issue, Label as LabelType } from "@/types";
import styles from "./boardCard.module.scss";

interface BoardCardProps {
  issue: Issue;
  projectId: string;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onClick?: () => void;
}

export function BoardCard({
  issue,
  projectId,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onClick,
}: BoardCardProps) {
  const { members, projects, labels, issueTypes } = useWorkspace();
  const timeAgo = useTimeAgo();
  const project = projects.find((p) => p.id === issue.project) ??
    projects.find((p) => p.id === projectId) ?? {
      prefix: "?",
      name: "?",
      color: "#686d76",
    };
  const assignee = issue.assignee
    ? (members.find((m) => m.id === issue.assignee) ?? null)
    : null;
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
      onClick={onClick}
      onKeyDown={onActivate(() => onClick?.())}
    >
      {/* Kopfzeile: Typ-Badge + Assignee — entfällt, wenn beides fehlt */}
      {(typeLabel || assignee) && (
        <div className={styles.header}>
          {typeLabel && typeColor && (
            <Label color={typeColor} filled hasIcon size="xs">
              <TypeIcon type={issue.type} size={10} color={typeColor} />
              {typeLabel}
            </Label>
          )}
          <Avatar avatar={assignee} size={30} />
        </div>
      )}

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
