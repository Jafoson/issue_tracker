"use client";
import { Icon } from "@iconify/react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { Button } from "@/components/ui/atoms/Button/Button";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { createIssue } from "@/features/issues/actions";
import {
  PriorityIcon,
  StatusIcon,
} from "@/features/issues/components/IssueIcons/IssueIcons";
import { LabelPickerMenu } from "@/features/issues/components/LabelPickerMenu/LabelPickerMenu";
import { useWorkspace } from "@/lib/workspace-context";
import type { Label } from "@/types";
import styles from "./issueComposer.module.scss";

interface IssueComposerProps {
  open: boolean;
  initialStatus?: string;
  onClose: () => void;
}

export function IssueComposer({
  open,
  initialStatus,
  onClose,
}: IssueComposerProps) {
  const {
    members,
    projects,
    labels: allLabels,
    statuses,
    priorities,
    me,
    workspace,
  } = useWorkspace();
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState(0);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [localLabels, setLocalLabels] = useState<Label[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);

  const statusName = (id: string) =>
    statuses.find((s) => s.id === id)?.name ?? id;
  const priorityName = (id: number) =>
    priorities.find((p) => p.id === id)?.name ?? String(id);

  const defaultProjectId = (() => {
    const seg = pathname.split("/");
    if (seg[3] === "project" && seg[4]) {
      return (
        projects.find((p) => p.slug === seg[4])?.id ?? projects[0]?.id ?? ""
      );
    }
    return projects[0]?.id ?? "";
  })();

  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId);
  const project =
    projects.find((p) => p.id === selectedProjectId) ?? projects[0];
  const assigneeUser = assignee
    ? (members.find((m) => m.id === assignee) ?? null)
    : null;

  const combinedLabels = [
    ...allLabels,
    ...localLabels.filter((l) => !allLabels.some((a) => a.id === l.id)),
  ];

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setStatus(initialStatus ?? "todo");
      setPriority(0);
      setAssignee(null);
      setLabels([]);
      setLocalLabels([]);
      setSelectedProjectId(defaultProjectId);
      setExpanded(false);
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [open, initialStatus, defaultProjectId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
        type: "task",
        projectId: project.id,
        reporterId: me.id,
      });
      router.refresh();
      onClose();
    });
  };

  if (!open) return null;

  const selectedLabelObjects = labels
    .map((id) => combinedLabels.find((l) => l.id === id))
    .filter(Boolean) as Label[];

  let labelTrigger: React.ReactElement;
  if (labels.length === 0) {
    labelTrigger = (
      <Button
        variant="ghost"
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
        variant="ghost"
        size="sm"
        icon={
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: l?.color ?? "var(--text-3)",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
        }
      >
        {l?.name ?? t("filters.labels", { count: 1 })}
      </Button>
    );
  } else {
    labelTrigger = (
      <Button
        variant="ghost"
        size="sm"
        icon={
          <span style={{ display: "flex", alignItems: "center" }}>
            {selectedLabelObjects.slice(0, 3).map((l, i) => (
              <span
                key={l.id}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: l.color,
                  display: "inline-block",
                  flexShrink: 0,
                  marginLeft: i > 0 ? -5 : 0,
                  boxShadow: "0 0 0 2px #17181d",
                }}
              />
            ))}
          </span>
        }
      >
        {t("filters.labels", { count: labels.length })}
      </Button>
    );
  }

  return createPortal(
    <div className={`orbit-overlay ${styles.overlay}`}>
      <button
        type="button"
        className="orbit-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div className={`orbit-comp ${expanded ? styles.compExpanded : ""}`}>
        <div className={styles.header}>
          <div className={styles.breadcrumb}>
            <InlinePicker
              trigger={
                <button type="button" className={styles.projectTrigger}>
                  <span
                    className="dot"
                    style={{
                      background: project?.color ?? "var(--text-3)",
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  {project?.name ?? "Projekt"}
                </button>
              }
              width={220}
              stop
            >
              {(close) => (
                <SelectMenu
                  items={projects.map((p) => ({
                    value: p.id,
                    label: p.name,
                    icon: (
                      <span
                        className="dot"
                        style={{
                          background: p.color ?? "var(--text-3)",
                          width: 9,
                          height: 9,
                          borderRadius: "50%",
                          display: "inline-block",
                        }}
                      />
                    ),
                  }))}
                  value={selectedProjectId}
                  onPick={(v) => {
                    setSelectedProjectId(v as string);
                    close();
                  }}
                  onClose={close}
                />
              )}
            </InlinePicker>
            <span className={styles.sep}>›</span>
            <span className={styles.pageTitle}>{t("actions.newIssue")}</span>
          </div>

          <div className={styles.headerRight}>
            <Button
              variant="ghost"
              size="sm"
              icon={
                <Icon
                  icon={expanded ? "lucide:minimize-2" : "lucide:maximize-2"}
                  width={14}
                />
              }
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "Verkleinern" : "Erweitern"}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon icon="lucide:x" width={15} />}
              onClick={onClose}
              title="Schließen"
            />
          </div>
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
            key={expanded ? "expanded" : "compact"}
            className={styles.descInput}
            placeholder={t("placeholders.addDescription")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={expanded ? 18 : 4}
          />
        </div>

        <div className={styles.toolbar}>
          <InlinePicker
            trigger={
              <Button
                variant="ghost"
                size="sm"
                icon={<StatusIcon status={status} size={14} />}
              >
                {statusName(status)}
              </Button>
            }
            width={200}
            stop
          >
            {(close) => (
              <SelectMenu
                items={statuses.map((s) => ({
                  value: s.id,
                  label: statusName(s.id),
                  icon: <StatusIcon status={s.id} size={15} />,
                }))}
                value={status}
                onPick={(v) => {
                  setStatus(v as string);
                  close();
                }}
                onClose={close}
              />
            )}
          </InlinePicker>

          <InlinePicker
            trigger={
              <Button
                variant="ghost"
                size="sm"
                icon={<PriorityIcon priority={priority} size={14} />}
              >
                {priorityName(priority)}
              </Button>
            }
            width={190}
            stop
          >
            {(close) => (
              <SelectMenu
                items={priorities.map((p) => ({
                  value: p.id,
                  label: priorityName(p.id),
                  icon: <PriorityIcon priority={p.id} size={15} />,
                }))}
                value={priority}
                onPick={(v) => {
                  setPriority(v as number);
                  close();
                }}
                onClose={close}
              />
            )}
          </InlinePicker>

          <InlinePicker
            trigger={
              <Button
                variant="ghost"
                size="sm"
                icon={<Avatar user={assigneeUser} size={15} />}
              >
                {assigneeUser
                  ? assigneeUser.name.split(" ")[0]
                  : t("fields.assignee")}
              </Button>
            }
            width={220}
            stop
          >
            {(close) => (
              <SelectMenu
                items={[
                  {
                    value: null,
                    label: t("fields.unassigned"),
                    icon: <Avatar user={null} size={18} />,
                  },
                  ...members.map((u) => ({
                    value: u.id,
                    label: u.name,
                    icon: <Avatar user={u} size={18} />,
                  })),
                ]}
                value={assignee}
                onPick={(v) => {
                  setAssignee(v as string | null);
                  close();
                }}
                onClose={close}
                searchable
              />
            )}
          </InlinePicker>

          <InlinePicker trigger={labelTrigger} maxWidth={320} stop>
            {(close) => (
              <LabelPickerMenu
                allLabels={combinedLabels}
                selected={labels}
                projectId={project?.id ?? ""}
                projectName={project?.name ?? "Projekt"}
                workspaceId={workspace.id}
                onPick={(id) =>
                  setLabels((cur) =>
                    cur.includes(id)
                      ? cur.filter((x) => x !== id)
                      : [...cur, id],
                  )
                }
                onCreated={(label) => setLocalLabels((cur) => [...cur, label])}
                onClose={close}
              />
            )}
          </InlinePicker>

          <Button
            variant="primary"
            style={{ marginLeft: "auto" }}
            disabled={!title.trim()}
            onClick={submit}
          >
            {t("actions.createIssue")}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
