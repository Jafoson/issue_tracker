"use client";
import { useTranslations } from "@/lib/translations-context";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { StatusIcon, PriorityIcon } from "@/features/issues/components/IssueIcons/IssueIcons";
import { Icon } from "@iconify/react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";

import { useWorkspace } from "@/lib/workspace-context";

import { timeAgo } from "@/lib/utils/date";
import type { Issue } from "@/types";
import styles from "./myIssues.module.scss";

interface Props { issues: Issue[]; }

export function MyIssues({ issues }: Props) {

  const { projects, statuses } = useWorkspace();
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const statusName = (id: string) => statuses.find((s) => s.id === id)?.name ?? id;

  const groups = statuses
    .filter((s) => s.id !== "done" && s.id !== "canceled")
    .map((s) => ({ ...s, issues: issues.filter((i) => i.status === s.id) }))
    .filter((g) => g.issues.length > 0);

  const openIssue = (id: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("issue", id);
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };

  if (issues.length === 0) {
    return (
      <div className={styles.empty}>
        <Icon icon="lucide:check" width={36} style={{ opacity: .3 }} />
        <p>{t.empty.noAssignedIssues}</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {groups.map((group) => (
        <div key={group.id} className={styles.group}>
          <div className={styles.groupHeader}>
            <StatusIcon status={group.id} size={15} />
            <span>{statusName(group.id)}</span>
            <Badge mono size="sm">{group.issues.length}</Badge>
          </div>
          {group.issues.map((issue) => {
            const project = projects.find((p) => p.id === issue.project) ?? { prefix: "?" };
            const identifier = `${project.prefix}-${issue.key}`;
            return (
              <div key={issue.id} className="orbit-row" onClick={() => openIssue(issue.id)}>
                <PriorityIcon priority={issue.priority} size={14} />
                <StatusIcon status={issue.status} size={14} />
                <span className="mono faint" style={{ fontSize: 11.5 }}>{identifier}</span>
                <span style={{ fontSize: 13.5, flex: 1 }}>{issue.title}</span>
                <span className="faint mono" style={{ fontSize: 11.5 }}>{timeAgo(issue.updated)}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
