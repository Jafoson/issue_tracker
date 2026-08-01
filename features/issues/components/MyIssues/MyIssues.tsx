"use client";
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import {
  PriorityIcon,
  StatusIcon,
} from "@/features/issues/components/IssueIcons/IssueIcons";
import { useIssueOpen } from "@/features/issues/issue-links";
import { Link } from "@/i18n/navigation";
import { timeAgo } from "@/lib/utils/date";
import type { Issue, Project, Status } from "@/types";
import styles from "./myIssues.module.scss";

interface Props {
  issues: Issue[];
  projects: Project[];
  statuses: Status[];
  /** Für den Pfad der Vollseite hinter Strg- und Mittelklick. */
  workspaceId: string;
}

export function MyIssues({ issues, projects, statuses, workspaceId }: Props) {
  const t = useTranslations();
  const issueOpen = useIssueOpen(workspaceId);

  const statusName = (id: string) =>
    statuses.find((s) => s.id === id)?.name ?? id;
  const statusColor = (id: string) => statuses.find((s) => s.id === id)?.color;

  const groups = statuses
    .filter((s) => s.id !== "done" && s.id !== "canceled")
    .map((s) => ({ ...s, issues: issues.filter((i) => i.status === s.id) }))
    .filter((g) => g.issues.length > 0);

  if (issues.length === 0) {
    return (
      <div className={styles.empty}>
        <Icon icon="lucide:check" width={36} style={{ opacity: 0.3 }} />
        <p>{t("empty.noAssignedIssues")}</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {groups.map((group) => (
        <div key={group.id} className={styles.group}>
          <div className={styles.groupHeader}>
            <StatusIcon status={group.id} size={15} color={group.color} />
            <span>{statusName(group.id)}</span>
            <Badge mono size="sm">
              {group.issues.length}
            </Badge>
          </div>
          {group.issues.map((issue) => {
            const project = projects.find((p) => p.id === issue.project) ?? {
              prefix: "?",
            };
            const identifier = `${project.prefix}-${issue.key}`;
            return (
              <Link
                key={issue.id}
                className="orbit-row"
                {...issueOpen.linkProps(identifier)}
                scroll={false}
              >
                <PriorityIcon priority={issue.priority} size={14} />
                <StatusIcon
                  status={issue.status}
                  size={14}
                  color={statusColor(issue.status)}
                />
                <span className="mono faint" style={{ fontSize: 11.5 }}>
                  {identifier}
                </span>
                <span style={{ fontSize: 13.5, flex: 1 }}>{issue.title}</span>
                <span className="faint mono" style={{ fontSize: 11.5 }}>
                  {timeAgo(issue.updated)}
                </span>
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
