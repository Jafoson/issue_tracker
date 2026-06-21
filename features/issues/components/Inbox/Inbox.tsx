"use client";
import { Icon } from "@iconify/react";
import Link from "next/link";

import { usePathname, useSearchParams } from "next/navigation";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { StatusIcon } from "@/features/issues/components/IssueIcons/IssueIcons";
import { useTranslations } from "@/lib/translations-context";
import { timeAgo } from "@/lib/utils/date";
import { useWorkspace } from "@/lib/workspace-context";
import type { Issue } from "@/types";
import styles from "./inbox.module.scss";

interface Props {
  issues: Issue[];
}

export function Inbox({ issues }: Props) {
  const { members, me, projects } = useWorkspace();
  const t = useTranslations();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const issueHref = (issue: Issue) => {
    const prefix = projects.find((p) => p.id === issue.project)?.prefix ?? "?";
    const params = new URLSearchParams(searchParams.toString());
    params.set("issue", `${prefix}-${issue.key}`);
    return `${pathname}?${params.toString()}`;
  };

  const notifications = issues
    .flatMap((issue) =>
      issue.comments
        .filter((c) => c.author !== me.id)
        .map((c) => ({ issue, comment: c })),
    )
    .sort((a, b) => b.comment.time - a.comment.time)
    .slice(0, 20);

  if (notifications.length === 0) {
    return (
      <div className={styles.empty}>
        <Icon icon="lucide:inbox" width={36} style={{ opacity: 0.3 }} />
        <p>{t.empty.allCaughtUp}</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {notifications.map(({ issue, comment }) => {
        const author = members.find((m) => m.id === comment.author) ?? null;
        return (
          <Link
            key={comment.id}
            className={styles.item}
            href={issueHref(issue)}
            scroll={false}
          >
            <Avatar user={author} size={30} />
            <div className={styles.content}>
              <div className={styles.meta}>
                <span className={styles.author}>{author?.name}</span>
                <span className="faint" style={{ fontSize: 12 }}>
                  {t.comments.commentedOn}
                </span>
                <StatusIcon status={issue.status} size={13} />
                <span className={styles.issueTitle}>{issue.title}</span>
                <span
                  className="faint mono"
                  style={{ fontSize: 11, marginLeft: "auto" }}
                >
                  {timeAgo(comment.time)}
                </span>
              </div>
              <p className={styles.body}>{comment.body}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
