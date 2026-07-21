"use client";

import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Label } from "@/components/ui/atoms/Label/Label";
import {
  PriorityIcon,
  TypeIcon,
} from "@/features/issues/components/IssueIcons/IssueIcons";
import { onActivate } from "@/lib/a11y";
import { timeAgo } from "@/lib/utils/date";
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
      {/* Top: type badge + avatar */}
      <div className={styles.cardTop}>
        {typeLabel && typeColor && (
          <Label color={typeColor} filled hasIcon size="sm">
            <TypeIcon type={issue.type} size={11} color={typeColor} />
            {typeLabel}
          </Label>
        )}
        <div className={styles.cardTopRight}>
          <Avatar avatar={assignee} size={28} />
        </div>
      </div>

      {/* Title */}
      <p className={styles.title}>{issue.title}</p>

      {/* Labels */}
      {issueLabels.length > 0 && (
        <div className={styles.labels}>
          {issueLabels.map((l) => (
            <Label key={l.id} color={l.color} size="sm">
              {l.name}
            </Label>
          ))}
        </div>
      )}

      {/* Bottom: priority + id | time + comments */}
      <div className={styles.cardBottom}>
        <PriorityIcon priority={issue.priority} size={13} />
        <span className={styles.id}>{identifier}</span>
        <span className={styles.time}>{timeAgo(issue.updated)}</span>
        {issue.comments.length > 0 && (
          <span className={styles.comments}>
            <svg
              width={11}
              height={11}
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v7A1.5 1.5 0 0 1 12.5 12H9l-3 2v-2H3.5A1.5 1.5 0 0 1 2 10.5v-7Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
            {issue.comments.length}
          </span>
        )}
      </div>
    </div>
  );
}
