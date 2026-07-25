"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Badge } from "@/components/ui/atoms/Badge/Badge";
import { Button } from "@/components/ui/atoms/Button/Button";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { createIssue } from "@/features/issues/actions";
import {
  PriorityIcon,
  StatusIcon,
  TypeIcon,
} from "@/features/issues/components/IssueIcons/IssueIcons";
import { LabelPickerMenu } from "@/features/issues/components/LabelPickerMenu/LabelPickerMenu";
import { fullName } from "@/lib/utils/string";
import { useWorkspace } from "@/lib/workspace-context";
import type { Label } from "@/types";
import styles from "./createIssueModal.module.scss";

interface CreateIssueModalProps {
  projectId: string;
  initialStatus: string;
  close: () => void;
}

export function CreateIssueModal({
  projectId,
  initialStatus,
  close,
}: CreateIssueModalProps) {
  const {
    members,
    projects,
    labels: allLabels,
    statuses,
    priorities,
    issueTypes,
    me,
    workspace,
  } = useWorkspace();
  const t = useTranslations();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const project = projects.find((p) => p.id === projectId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [priority, setPriority] = useState(0);
  const [type, setType] = useState(issueTypes[0]?.id ?? "feature");
  const [assignee, setAssignee] = useState<string | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [localLabels, setLocalLabels] = useState<Label[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focusTimer = setTimeout(() => titleRef.current?.focus(), 50);
    return () => clearTimeout(focusTimer);
  }, []);

  const combinedLabels = [
    ...allLabels,
    ...localLabels.filter((l) => !allLabels.some((a) => a.id === l.id)),
  ];
  const assigneeUser = assignee
    ? (members.find((m) => m.id === assignee) ?? null)
    : null;

  const statusName = (id: string) =>
    statuses.find((s) => s.id === id)?.name ?? id;
  const priorityName = (id: number) =>
    priorities.find((p) => p.id === id)?.name ?? String(id);
  const typeName = (id: string) =>
    issueTypes.find((x) => x.id === id)?.name ?? id;

  const submit = () => {
    if (!title.trim() || !project) return;
    startTransition(async () => {
      await createIssue({
        title: title.trim(),
        description,
        status,
        priority,
        assignee,
        labels,
        type,
        projectId: project.id,
        reporterId: me.id,
      });
      router.refresh();
      close();
    });
  };

  // Kein Dependency-Array — hält den Closure über den aktuellen Formularstand
  // aktuell, damit ⌘/Ctrl+Enter immer den zuletzt eingegebenen Titel erfasst.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!project) return null;

  const selectedLabelObjects = labels
    .map((id) => combinedLabels.find((l) => l.id === id))
    .filter(Boolean) as Label[];

  let labelTrigger: React.ReactElement;
  if (labels.length === 0) {
    labelTrigger = (
      <Button
        variant="outline"
        size="sm"
        icon={<Icon icon="lucide:tag" width={13} />}
      >
        {t("fields.label")}
      </Button>
    );
  } else if (labels.length === 1) {
    const l = selectedLabelObjects[0];
    labelTrigger = (
      <Button
        variant="outline"
        size="sm"
        icon={<span className="dot" style={{ background: l?.color }} />}
      >
        {l?.name}
      </Button>
    );
  } else {
    labelTrigger = (
      <Button
        variant="outline"
        size="sm"
        icon={
          <span className={styles.labelStack}>
            {selectedLabelObjects.slice(0, 3).map((l) => (
              <span
                key={l.id}
                className={styles.labelDot}
                style={{ background: l.color }}
              />
            ))}
          </span>
        }
      >
        {t("filters.labels", { count: labels.length })}
      </Button>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Badge>
            <span className="dot" style={{ background: project.color }} />
            {project.prefix}
          </Badge>
          <span className={styles.headerTitle}>{t("actions.newIssue")}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<Icon icon="lucide:x" width={15} />}
          onClick={close}
        />
      </div>

      <div className={styles.body}>
        <input
          ref={titleRef}
          className={styles.titleInput}
          placeholder={t("placeholders.issueTitle")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <textarea
          className={styles.descInput}
          placeholder={t("placeholders.addDescription")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
      </div>

      <div className={styles.toolbar}>
        <InlinePicker
          trigger={
            <Button
              variant="outline"
              size="sm"
              icon={<TypeIcon type={type} size={14} />}
            >
              {typeName(type)}
            </Button>
          }
          width={190}
          stop
        >
          {(closeMenu) => (
            <SelectMenu
              items={issueTypes.map((x) => ({
                value: x.id,
                label: x.name,
                icon: <TypeIcon type={x.id} size={15} />,
              }))}
              value={type}
              onPick={(v) => {
                setType(v as string);
                closeMenu();
              }}
              onClose={closeMenu}
            />
          )}
        </InlinePicker>

        <InlinePicker
          trigger={
            <Button
              variant="outline"
              size="sm"
              icon={<StatusIcon status={status} size={14} />}
            >
              {statusName(status)}
            </Button>
          }
          width={200}
          stop
        >
          {(closeMenu) => (
            <SelectMenu
              items={statuses.map((s) => ({
                value: s.id,
                label: statusName(s.id),
                icon: <StatusIcon status={s.id} size={15} />,
              }))}
              value={status}
              onPick={(v) => {
                setStatus(v as string);
                closeMenu();
              }}
              onClose={closeMenu}
            />
          )}
        </InlinePicker>

        <InlinePicker
          trigger={
            <Button
              variant="outline"
              size="sm"
              icon={<PriorityIcon priority={priority} size={14} />}
            >
              {priorityName(priority)}
            </Button>
          }
          width={190}
          stop
        >
          {(closeMenu) => (
            <SelectMenu
              items={priorities.map((p) => ({
                value: p.id,
                label: priorityName(p.id),
                icon: <PriorityIcon priority={p.id} size={15} />,
              }))}
              value={priority}
              onPick={(v) => {
                setPriority(v as number);
                closeMenu();
              }}
              onClose={closeMenu}
            />
          )}
        </InlinePicker>

        <InlinePicker
          trigger={
            <Button
              variant="outline"
              size="sm"
              icon={
                assigneeUser ? (
                  <Avatar avatar={assigneeUser} size={15} />
                ) : (
                  <Icon icon="lucide:circle-dashed" width={14} />
                )
              }
            >
              {assigneeUser ? assigneeUser.firstName : t("fields.assignee")}
            </Button>
          }
          width={220}
          stop
        >
          {(closeMenu) => (
            <SelectMenu
              items={[
                {
                  value: null,
                  label: t("fields.unassigned"),
                  icon: <Avatar avatar={null} size={18} />,
                },
                ...members.map((u) => ({
                  value: u.id,
                  label: fullName(u),
                  icon: <Avatar avatar={u} size={18} />,
                })),
              ]}
              value={assignee}
              onPick={(v) => {
                setAssignee(v as string | null);
                closeMenu();
              }}
              onClose={closeMenu}
              searchable
            />
          )}
        </InlinePicker>

        <InlinePicker trigger={labelTrigger} maxWidth={320} stop>
          {(closeMenu) => (
            <LabelPickerMenu
              allLabels={combinedLabels}
              selected={labels}
              projectId={project.id}
              projectName={project.name}
              workspaceId={workspace.id}
              onPick={(id) =>
                setLabels((cur) =>
                  cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
                )
              }
              onCreated={(label) => setLocalLabels((cur) => [...cur, label])}
              onClose={closeMenu}
              keepOpen
            />
          )}
        </InlinePicker>
      </div>

      <div className={styles.footer}>
        <div className={styles.shortcut}>
          <kbd>⌘</kbd>
          <kbd>↵</kbd> {t("issues.toCreate")}
        </div>
        <div className={styles.footerActions}>
          <Button variant="ghost" onClick={close}>
            {t("actions.cancel")}
          </Button>
          <Button variant="primary" disabled={!title.trim()} onClick={submit}>
            {t("actions.createIssue")}
          </Button>
        </div>
      </div>
    </div>
  );
}
