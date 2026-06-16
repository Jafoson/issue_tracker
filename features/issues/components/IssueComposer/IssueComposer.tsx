"use client";
import { useTranslations } from "@/lib/translations-context";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Button } from "@/components/ui/atoms/Button/Button";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { StatusIcon, PriorityIcon } from "@/features/issues/components/IssueIcons/IssueIcons";
import { Icon } from "@iconify/react";

import { useWorkspace } from "@/lib/workspace-context";

import { createIssue } from "@/features/issues/actions";
import styles from "./issueComposer.module.scss";

interface IssueComposerProps {
  open: boolean;
  onClose: () => void;
}

export function IssueComposer({ open, onClose }: IssueComposerProps) {

  const { members, projects, labels: allLabels, statuses, priorities, me } = useWorkspace();
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState(0);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);

  const statusName   = (id: string) => statuses.find((s) => s.id === id)?.name ?? id;
  const priorityName = (id: number) => priorities.find((p) => p.id === id)?.name ?? String(id);

  const activeProjectId = (() => {
    const seg = pathname.split("/");
    if (seg[4] === "board" || seg[4] === "list") return seg[5] ?? projects[0]?.id ?? "";
    return projects[0]?.id ?? "";
  })();

  const project = projects.find((p) => p.id === activeProjectId) ?? projects[0];
  const assigneeUser = assignee ? (members.find((m) => m.id === assignee) ?? null) : null;

  useEffect(() => {
    if (open) {
      setTitle(""); setDescription(""); setStatus("todo");
      setPriority(0); setAssignee(null); setLabels([]);
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = () => {
    if (!title.trim() || !project) return;
    startTransition(async () => {
      await createIssue({
        title: title.trim(), description, status, priority,
        assignee, labels, type: "task",
        projectId: project.id, reporterId: me.id,
      });
      router.refresh();
      onClose();
    });
  };

  if (!open) return null;

  return createPortal(
    <div className="orbit-overlay" onClick={onClose}>
      <div className="orbit-comp" onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span style={{ fontSize: 13, fontWeight: 550 }}>{t.actions.newIssue}</span>
          <span className="faint mono" style={{ fontSize: 12 }}>{project?.prefix}</span>
        </div>

        <div className={styles.body}>
          <input ref={titleRef} className={styles.titleInput}
            placeholder={t.placeholders.issueTitle}
            value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
          <textarea className={styles.descInput}
            placeholder={t.placeholders.addDescription}
            value={description} onChange={(e) => setDescription(e.target.value)}
            rows={4} />
        </div>

        <div className={styles.toolbar}>
          <InlinePicker trigger={<Button variant="ghost" size="sm" icon={<StatusIcon status={status} size={14} />}>{statusName(status)}</Button>} width={200} stop>
            {(close) => (
              <SelectMenu items={statuses.map((s) => ({ value: s.id, label: statusName(s.id), icon: <StatusIcon status={s.id} size={15} /> }))}
                value={status} onPick={(v) => { setStatus(v as string); close(); }} onClose={close} />
            )}
          </InlinePicker>

          <InlinePicker trigger={<Button variant="ghost" size="sm" icon={<PriorityIcon priority={priority} size={14} />}>{priorityName(priority)}</Button>} width={190} stop>
            {(close) => (
              <SelectMenu items={priorities.map((p) => ({ value: p.id, label: priorityName(p.id), icon: <PriorityIcon priority={p.id} size={15} /> }))}
                value={priority} onPick={(v) => { setPriority(v as number); close(); }} onClose={close} />
            )}
          </InlinePicker>

          <InlinePicker trigger={<Button variant="ghost" size="sm" icon={<Avatar user={assigneeUser} size={15} />}>{assigneeUser ? assigneeUser.name.split(" ")[0] : t.fields.assignee}</Button>} width={220} stop>
            {(close) => (
              <SelectMenu items={[{ value: null, label: t.fields.unassigned, icon: <Avatar user={null} size={18} /> }, ...members.map((u) => ({ value: u.id, label: u.name, icon: <Avatar user={u} size={18} /> }))]}
                value={assignee} onPick={(v) => { setAssignee(v as string | null); close(); }} onClose={close} searchable />
            )}
          </InlinePicker>

          <InlinePicker trigger={<Button variant="ghost" size="sm" icon={<Icon icon="lucide:tag" width={13} />}>{labels.length === 0 ? t.fields.label : t.filters.labels(labels.length)}</Button>} width={200} stop>
            <SelectMenu items={allLabels.map((l) => ({ value: l.id, label: l.name, icon: <span className="dot" style={{ background: l.color, width: 9, height: 9 }} /> }))}
              value={labels} onPick={(v) => { setLabels((cur) => cur.includes(v as string) ? cur.filter((x) => x !== v) : [...cur, v as string]); }} multi />
          </InlinePicker>

          <Button variant="primary" style={{ marginLeft: "auto" }} disabled={!title.trim()} onClick={submit}>
            {t.actions.createIssue}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
