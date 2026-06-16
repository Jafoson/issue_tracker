"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { StatusIcon } from "@/features/issues/components/IssueIcons/IssueIcons";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Icon } from "@iconify/react";
import { useUI } from "@/lib/ui-store";
import { useWorkspace } from "@/lib/workspace-context";
import { getT } from "@/lib/i18n";
import { timeAgo } from "@/lib/utils/date";
import type { Issue } from "@/types";
import styles from "./inbox.module.scss";

interface Props { issues: Issue[]; }

export function Inbox({ issues }: Props) {
  const { ui } = useUI();
  const { members, me } = useWorkspace();
  const t = getT(ui.locale);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const notifications = issues
    .flatMap((issue) =>
      issue.comments
        .filter((c) => c.author !== me.id)
        .map((c) => ({ issue, comment: c })),
    )
    .sort((a, b) => b.comment.time - a.comment.time)
    .slice(0, 20);

  const openIssue = (id: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("issue", id);
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };

  if (notifications.length === 0) {
    return (
      <div className={styles.empty}>
        <Icon icon="lucide:inbox" width={36} style={{ opacity: .3 }} />
        <p>{t.empty.allCaughtUp}</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {notifications.map(({ issue, comment }) => {
        const author = members.find((m) => m.id === comment.author) ?? null;
        return (
          <div key={comment.id} className={styles.item} onClick={() => openIssue(issue.id)}>
            <Avatar user={author} size={30} />
            <div className={styles.content}>
              <div className={styles.meta}>
                <span className={styles.author}>{author?.name}</span>
                <span className="faint" style={{ fontSize: 12 }}>{t.comments.commentedOn}</span>
                <StatusIcon status={issue.status} size={13} />
                <span className={styles.issueTitle}>{issue.title}</span>
                <span className="faint mono" style={{ fontSize: 11, marginLeft: "auto" }}>{timeAgo(comment.time)}</span>
              </div>
              <p className={styles.body}>{comment.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
