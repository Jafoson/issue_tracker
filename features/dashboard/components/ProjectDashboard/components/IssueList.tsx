"use client";

import { Icon } from "@iconify/react";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { EmptyState } from "@/components/ui/atoms/EmptyState/EmptyState";
import type { DashboardIssue } from "@/features/dashboard/types";
import {
  PriorityIcon,
  StatusIcon,
} from "@/features/issues/components/IssueIcons/IssueIcons";
import { Link } from "@/i18n/navigation";
import { useTimeAgo } from "@/lib/utils/useTimeAgo";
import styles from "./issueList.module.scss";

interface Props<T extends DashboardIssue> {
  issues: T[];
  /** Baut die Adresse einer Aufgabe aus ihrer Kennung (`NIM-142`). */
  hrefFor: (ref: string) => string;
  /**
   * Ein Zeichen ganz rechts, vor dem Zeitpunkt — z. B. „Liegengeblieben".
   *
   * Bekommt die Zeile in ihrem eigenen Typ, nicht nur als `DashboardIssue`:
   * „Braucht Aufmerksamkeit" hängt ihren Grund an die Zeile, und ohne den
   * Typparameter müsste der Aufrufer ihn sich aus seiner eigenen Liste
   * zurücksuchen.
   */
  badgeFor?: (issue: T) => ReactNode;
  emptyIcon: ReactNode;
  emptyTitle: string;
  emptyDescription?: string;
}

/**
 * Eine kurze Liste von Aufgaben, wie das Dashboard sie zeigt: Dringlichkeit,
 * Status, Kennung, Titel — und rechts, wer zuständig ist und wann zuletzt
 * etwas geschah.
 *
 * Jede Zeile ist ein Link auf die Aufgabe. Das ist der Zweck der Liste: sie
 * beantwortet keine Frage abschließend, sondern zeigt, wo man weiterlesen muss.
 *
 * Die beiden Zeichen links stehen in fester Reihenfolge und fester Breite,
 * damit sie über die Zeilen hinweg zwei Spalten bilden statt zu tanzen — wie im
 * Board und in der Liste, aus denen sie stammen.
 */
export function IssueList<T extends DashboardIssue>({
  issues,
  hrefFor,
  badgeFor,
  emptyIcon,
  emptyTitle,
  emptyDescription,
}: Props<T>) {
  const timeAgo = useTimeAgo();

  if (issues.length === 0) {
    return (
      <EmptyState
        className={styles.empty}
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <ul className={styles.list}>
      {issues.map((issue) => {
        const badge = badgeFor?.(issue);
        return (
          <li key={issue.id}>
            <Link href={hrefFor(issue.ref)} className={styles.row}>
              <span className={styles.icons}>
                <PriorityIcon priority={issue.priority} size={14} />
                <StatusIcon
                  status={issue.status}
                  size={14}
                  color={issue.statusColor}
                />
              </span>

              <span className={styles.ref}>{issue.ref}</span>
              <span className={styles.title}>{issue.title}</span>

              {badge}

              {/* Ohne Zuständige bleibt der Platz leer statt gefüllt: ein
                  Platzhalter-Avatar sähe hier aus wie eine Person. */}
              {issue.assignee ? (
                <Avatar avatar={issue.assignee} size={20} />
              ) : (
                <span className={styles.noAvatar} aria-hidden="true" />
              )}

              <span className={styles.time}>{timeAgo(issue.updated)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Das Zeichen für einen Grund in „Braucht Aufmerksamkeit". */
export function ReasonBadge({ icon, label }: { icon: string; label: string }) {
  return (
    <Badge size="sm" mono={false} className={styles.reason}>
      <Icon icon={icon} width={12} />
      {label}
    </Badge>
  );
}
