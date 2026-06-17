"use client";
import { useTranslations } from "@/lib/translations-context";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Button } from "@/components/ui/atoms/Button/Button";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { StatusIcon, PriorityIcon } from "@/features/issues/components/IssueIcons/IssueIcons";
import { Icon } from "@iconify/react";

import { useWorkspace } from "@/lib/workspace-context";

import { timeAgo } from "@/lib/utils/date";
import { updateIssue, deleteIssue, addComment } from "@/features/issues/actions";
import type { Issue } from "@/types";
import styles from "./issueDetail.module.scss";

interface Props { id: string; onClose: () => void; initialIssue?: Issue; inline?: boolean; }

function SideField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.sideField}>
      <span className={styles.sideLabel}>{label}</span>
      <div className={styles.sideValue}>{children}</div>
    </div>
  );
}

export function IssueDetail({ id, onClose, initialIssue, inline }: Props) {

  const { members, projects, labels, statuses, priorities, me } = useWorkspace();
  const t = useTranslations();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [issue, setIssue]     = useState<Issue | null>(initialIssue ?? null);
  const [commentBody, setCommentBody] = useState("");

  useEffect(() => {
    if (!initialIssue) {
      setIssue(null);
      fetch(`/api/issues/${id}`).then((r) => r.json()).then(setIssue);
    }
  }, [id, initialIssue]);

  if (!issue) {
    const loading = (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
        <span className="faint">Loading…</span>
      </div>
    );
    if (inline) return loading;
    return createPortal(
      <div className="orbit-overlay" onClick={onClose}>
        <div className="orbit-panel" onClick={(e) => e.stopPropagation()}>{loading}</div>
      </div>,
      document.body,
    );
  }

  const project  = projects.find((p) => p.id === issue.project) ?? { prefix: "?", name: "?", color: "#686d76" };
  const assignee = issue.assignee ? (members.find((m) => m.id === issue.assignee) ?? null) : null;
  const identifier = `${project.prefix}-${issue.key}`;

  const patch = (p: Parameters<typeof updateIssue>[1]) =>
    startTransition(async () => {
      await updateIssue(issue.id, p);
      const fresh = await fetch(`/api/issues/${id}`).then((r) => r.json());
      setIssue(fresh);
      router.refresh();
    });

  const handleAddComment = () => {
    if (!commentBody.trim()) return;
    startTransition(async () => {
      await addComment(issue.id, commentBody.trim(), me.id);
      const fresh = await fetch(`/api/issues/${id}`).then((r) => r.json());
      setIssue(fresh);
      setCommentBody("");
      router.refresh();
    });
  };

  const handleDelete = () =>
    startTransition(async () => {
      await deleteIssue(issue.id);
      onClose();
      router.refresh();
    });

  const statusName   = (sid: string) => statuses.find((s) => s.id === sid)?.name ?? sid;
  const priorityName = (pid: number) => priorities.find((p) => p.id === pid)?.name ?? String(pid);

  const content = (
      <div className={inline ? styles.inlineWrap : "orbit-panel"} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className="mono faint" style={{ fontSize: 12 }}>{identifier}</span>
            <InlinePicker trigger={<button className="iconbtn"><StatusIcon status={issue.status} size={16} /></button>} width={200} stop>
              {(close) => (
                <SelectMenu items={statuses.map((s) => ({ value: s.id, label: statusName(s.id), icon: <StatusIcon status={s.id} size={15} /> }))}
                  value={issue.status} onPick={(v) => { patch({ status: v as string }); close(); }} onClose={close} />
              )}
            </InlinePicker>
          </div>
          <button className="iconbtn" onClick={onClose}><Icon icon="lucide:x" width={18} /></button>
        </div>

        <div className={styles.body}>
          <div className={styles.main}>
            <h2 className={styles.title}>{issue.title}</h2>
            {issue.description && (
              <div className={`md ${styles.desc}`} dangerouslySetInnerHTML={{ __html: issue.description.replace(/\n/g, "<br/>") }} />
            )}
            <div className={styles.comments}>
              <div className={styles.commentsHeader}>
                <Icon icon="lucide:message-square" width={14} className="faint" />
                <span style={{ fontSize: 13, fontWeight: 550 }}>
                  {t.comments.title}{issue.comments.length > 0 && ` (${issue.comments.length})`}
                </span>
              </div>
              {issue.comments.map((c) => {
                const author = members.find((m) => m.id === c.author) ?? null;
                return (
                  <div key={c.id} className={styles.comment}>
                    <Avatar user={author} size={26} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 550, fontSize: 13 }}>{author?.name}</span>
                        <span className="faint mono" style={{ fontSize: 11 }}>{timeAgo(c.time)}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>{c.body}</p>
                    </div>
                  </div>
                );
              })}
              <div className={styles.commentInput}>
                <Avatar user={me} size={26} />
                <div className={styles.commentBox}>
                  <textarea className="field" placeholder={t.placeholders.addComment}
                    value={commentBody} onChange={(e) => setCommentBody(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddComment(); }}
                    rows={3} style={{ resize: "vertical", width: "100%" }} />
                  {commentBody.trim() && (
                    <Button variant="primary" style={{ marginTop: 6 }} onClick={handleAddComment}>
                      {t.actions.comment}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <aside className={styles.sidebar}>
            <SideField label={t.fields.status}>
              <InlinePicker trigger={<button className={styles.sideBtn}><StatusIcon status={issue.status} size={14} />{statusName(issue.status)}</button>} width={200} stop>
                {(close) => (
                  <SelectMenu items={statuses.map((s) => ({ value: s.id, label: statusName(s.id), icon: <StatusIcon status={s.id} size={15} /> }))}
                    value={issue.status} onPick={(v) => { patch({ status: v as string }); close(); }} onClose={close} />
                )}
              </InlinePicker>
            </SideField>
            <SideField label={t.fields.priority}>
              <InlinePicker trigger={<button className={styles.sideBtn}><PriorityIcon priority={issue.priority} size={14} />{priorityName(issue.priority)}</button>} width={190} stop>
                {(close) => (
                  <SelectMenu items={priorities.map((p) => ({ value: p.id, label: priorityName(p.id), icon: <PriorityIcon priority={p.id} size={15} /> }))}
                    value={issue.priority} onPick={(v) => { patch({ priority: v as number }); close(); }} onClose={close} />
                )}
              </InlinePicker>
            </SideField>
            <SideField label={t.fields.assignee}>
              <InlinePicker trigger={<button className={styles.sideBtn}><Avatar user={assignee} size={16} />{assignee?.name ?? t.fields.unassigned}</button>} width={220} stop>
                {(close) => (
                  <SelectMenu items={[{ value: null, label: t.fields.unassigned, icon: <Avatar user={null} size={18} /> }, ...members.map((u) => ({ value: u.id, label: u.name, icon: <Avatar user={u} size={18} /> }))]}
                    value={issue.assignee} onPick={(v) => { patch({ assignee: v as string | null }); close(); }} onClose={close} searchable />
                )}
              </InlinePicker>
            </SideField>
            <SideField label={t.fields.labels}>
              <InlinePicker trigger={<button className={styles.sideBtn}><Icon icon="lucide:tag" width={13} />{issue.labels.length === 0 ? t.fields.none : issue.labels.map((l) => labels.find((x) => x.id === l)?.name ?? l).join(", ")}</button>} width={210} stop>
                <SelectMenu items={labels.map((l) => ({ value: l.id, label: l.name, icon: <span className="dot" style={{ background: l.color, width: 9, height: 9 }} /> }))}
                  value={issue.labels}
                  onPick={(v) => {
                    const next = issue.labels.includes(v as string) ? issue.labels.filter((x) => x !== v) : [...issue.labels, v as string];
                    patch({ labels: next });
                  }}
                  multi />
              </InlinePicker>
            </SideField>
            <SideField label={t.fields.project}>
              <div className={styles.sideBtn} style={{ cursor: "default" }}>
                <span className="dot" style={{ background: project.color, width: 9, height: 9 }} />{project.name}
              </div>
            </SideField>
            <SideField label={t.fields.created}>
              <span className={styles.sideBtn} style={{ cursor: "default" }}>{new Date(issue.created).toLocaleDateString()}</span>
            </SideField>
            <SideField label={t.fields.updated}>
              <span className={styles.sideBtn} style={{ cursor: "default" }}>{timeAgo(issue.updated)}</span>
            </SideField>
            <div className={styles.sideActions}>
              <Button variant="ghost" full icon={<Icon icon="lucide:trash-2" width={14} />} style={{ color: "var(--red, #e05252)" }} onClick={handleDelete}>
                {t.actions.deleteIssue}
              </Button>
            </div>
          </aside>
        </div>
      </div>
  );

  if (inline) return content;
  return createPortal(
    <div className="orbit-overlay" onClick={onClose}>{content}</div>,
    document.body,
  );
}
