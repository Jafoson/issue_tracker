"use client";
import { useTranslations } from "@/lib/translations-context";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { StatusIcon, PriorityIcon } from "@/features/issues/components/IssueIcons/IssueIcons";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { Icon } from "@iconify/react";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Label } from "@/components/ui/atoms/Label/Label";

import { useWorkspace } from "@/lib/workspace-context";

import { timeAgo } from "@/lib/utils/date";
import { updateIssue } from "@/features/issues/actions";
import type { Issue } from "@/types";
import styles from "./listView.module.scss";

interface Props { issues: Issue[]; projectId: string; }

function IssueRow({ issue }: { issue: Issue }) {

  const { members, projects, labels, statuses, priorities } = useWorkspace();
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const statusName   = (id: string) => statuses.find((s) => s.id === id)?.name ?? id;
  const priorityName = (id: number) => priorities.find((p) => p.id === id)?.name ?? String(id);
  const project  = projects.find((p) => p.id === issue.project) ?? { prefix: "?", name: "?", color: "#686d76" };
  const assignee = issue.assignee ? members.find((m) => m.id === issue.assignee) ?? null : null;
  const identifier = `${project.prefix}-${issue.key}`;

  const openIssue = () => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("issue", issue.id);
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const patch = (p: Parameters<typeof updateIssue>[1]) =>
    startTransition(async () => { await updateIssue(issue.id, p); router.refresh(); });

  return (
    <div className="orbit-row" onClick={openIssue}>
      <div className={styles.rowLeft}>
        <InlinePicker trigger={<button className="iconbtn" onClick={(e) => e.stopPropagation()}><PriorityIcon priority={issue.priority} size={15} /></button>} width={190} stop>
          {(close) => (
            <SelectMenu items={priorities.map((p) => ({ value: p.id, label: priorityName(p.id), icon: <PriorityIcon priority={p.id} size={15} /> }))}
              value={issue.priority} onPick={(v) => { patch({ priority: v as number }); close(); }} onClose={close} />
          )}
        </InlinePicker>

        <InlinePicker trigger={<button className="iconbtn" onClick={(e) => e.stopPropagation()}><StatusIcon status={issue.status} size={15} /></button>} width={200} stop>
          {(close) => (
            <SelectMenu items={statuses.map((s) => ({ value: s.id, label: statusName(s.id), icon: <StatusIcon status={s.id} size={15} /> }))}
              value={issue.status} onPick={(v) => { patch({ status: v as string }); close(); }} onClose={close} />
          )}
        </InlinePicker>

        <span className={`mono ${styles.identifier}`}>{identifier}</span>
        <span className={styles.rowTitle}>{issue.title}</span>

        {issue.labels.slice(0, 2).map((lid) => {
          const l = labels.find((x) => x.id === lid) ?? null;
          if (!l) return null;
          return (
            <Label key={lid} color={l.color} size="sm">{l.name}</Label>
          );
        })}
      </div>

      <div className={styles.rowRight}>
        <Label color={project.color} size="sm">{project.prefix}</Label>
        <span className="faint mono" style={{ fontSize: 11.5 }}>{timeAgo(issue.updated)}</span>

        <InlinePicker trigger={<button className="iconbtn" onClick={(e) => e.stopPropagation()} style={{ padding: "2px" }}><Avatar user={assignee} size={22} /></button>} width={220} align="end" stop>
          {(close) => (
            <SelectMenu items={[{ value: null, label: t.fields.unassigned, icon: <Avatar user={null} size={18} /> }, ...members.map((u) => ({ value: u.id, label: u.name, icon: <Avatar user={u} size={18} /> }))]}
              value={issue.assignee} onPick={(v) => { patch({ assignee: v as string | null }); close(); }} onClose={close} searchable />
          )}
        </InlinePicker>
      </div>
    </div>
  );
}

export function ListView({ issues }: Props) {

  const t = useTranslations();

  if (issues.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 8, color: "var(--text-3)" }}>
        <Icon icon="lucide:list" width={32} />
        <span style={{ fontSize: 14 }}>{t.empty.noIssues}</span>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {issues.map((issue) => (
        <IssueRow key={issue.id} issue={issue} />
      ))}
    </div>
  );
}
