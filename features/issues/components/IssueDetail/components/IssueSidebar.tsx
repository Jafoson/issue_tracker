"use client";

import { Icon } from "@iconify/react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { Label as LabelChip } from "@/components/ui/atoms/Label/Label";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import {
  PriorityIcon,
  StatusIcon,
  TypeIcon,
} from "@/features/issues/components/IssueIcons/IssueIcons";
import { LabelPickerMenu } from "@/features/issues/components/LabelPickerMenu/LabelPickerMenu";
import type { IssueComposerData, IssuePatch } from "@/features/issues/types";
import { fullName } from "@/lib/utils/string";
import { useTimeAgo } from "@/lib/utils/useTimeAgo";
import type { Issue, Label } from "@/types";
import styles from "../issueDetail.module.scss";

interface IssueSidebarProps {
  issue: Issue;
  data: IssueComposerData;
  onPatch: (patch: IssuePatch) => void;
}

/** Beschriftete Zeile der Attributspalte: Name links, Wert rechts. */
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <div className={styles.rowValue}>{children}</div>
    </div>
  );
}

/**
 * Attributspalte der Detailansicht. Typ, Status, Priorität, Zuständigkeit und
 * Labels sind direkt hier änderbar — Projekt, Ersteller und die Zeitstempel
 * zeigen nur an, weil sie feststehen oder woanders gepflegt werden.
 */
export function IssueSidebar({ issue, data, onPatch }: IssueSidebarProps) {
  const { members, projects, labels, statuses, priorities, issueTypes } = data;
  const t = useTranslations();
  const format = useFormatter();
  const timeAgo = useTimeAgo();

  // Im Label-Picker neu angelegte Labels kennt die Server-Prop noch nicht —
  // bis zum nächsten Refresh kommen sie von hier.
  const [createdLabels, setCreatedLabels] = useState<Label[]>([]);
  const knownLabels = [
    ...labels,
    ...createdLabels.filter((l) => !labels.some((known) => known.id === l.id)),
  ];

  const type = issueTypes.find((x) => x.id === issue.type);
  const status = statuses.find((s) => s.id === issue.status);
  const priority = priorities.find((p) => p.id === issue.priority);
  const project = projects.find((p) => p.id === issue.project);
  const assignee = issue.assignee
    ? (members.find((m) => m.id === issue.assignee) ?? null)
    : null;
  const reporter = members.find((m) => m.id === issue.reporter) ?? null;
  const issueLabels = issue.labels
    .map((id) => knownLabels.find((l) => l.id === id))
    .filter((l): l is Label => Boolean(l));

  const toggleLabel = (id: string) =>
    onPatch({
      labels: issue.labels.includes(id)
        ? issue.labels.filter((x) => x !== id)
        : [...issue.labels, id],
    });

  return (
    <aside className={styles.sidebar}>
      <Row label={t("fields.type")}>
        <InlinePicker
          width={190}
          stop
          trigger={
            <button type="button" className={styles.valueBtn}>
              <TypeIcon type={issue.type} size={14} color={type?.color} />
              <span className={styles.valueText}>
                {type?.name ?? issue.type}
              </span>
            </button>
          }
        >
          {(close) => (
            <SelectMenu
              items={issueTypes.map((x) => ({
                value: x.id,
                label: x.name,
                icon: <TypeIcon type={x.id} size={15} color={x.color} />,
              }))}
              value={issue.type}
              onPick={(value) => {
                onPatch({ type: value as string });
                close();
              }}
              onClose={close}
            />
          )}
        </InlinePicker>
      </Row>

      <Row label={t("fields.status")}>
        <InlinePicker
          width={200}
          stop
          trigger={
            <button type="button" className={styles.valueBtn}>
              <StatusIcon
                status={issue.status}
                size={14}
                color={status?.color}
              />
              <span className={styles.valueText}>
                {status?.name ?? issue.status}
              </span>
            </button>
          }
        >
          {(close) => (
            <SelectMenu
              items={statuses.map((s) => ({
                value: s.id,
                label: s.name,
                icon: <StatusIcon status={s.id} size={15} color={s.color} />,
              }))}
              value={issue.status}
              onPick={(value) => {
                onPatch({ status: value as string });
                close();
              }}
              onClose={close}
            />
          )}
        </InlinePicker>
      </Row>

      <Row label={t("fields.priority")}>
        <InlinePicker
          width={190}
          stop
          trigger={
            <button type="button" className={styles.valueBtn}>
              <PriorityIcon priority={issue.priority} size={14} />
              <span className={styles.valueText}>
                {priority?.name ?? String(issue.priority)}
              </span>
            </button>
          }
        >
          {(close) => (
            <SelectMenu
              items={priorities.map((p) => ({
                value: p.id,
                label: p.name,
                icon: <PriorityIcon priority={p.id} size={15} />,
              }))}
              value={issue.priority}
              onPick={(value) => {
                onPatch({ priority: value as number });
                close();
              }}
              onClose={close}
            />
          )}
        </InlinePicker>
      </Row>

      <Row label={t("fields.assignee")}>
        <InlinePicker
          width={220}
          stop
          trigger={
            <button type="button" className={styles.valueBtn}>
              <Avatar avatar={assignee} size={20} placeholder />
              <span className={styles.valueText}>
                {assignee ? fullName(assignee) : t("fields.unassigned")}
              </span>
            </button>
          }
        >
          {(close) => (
            <SelectMenu
              items={[
                {
                  value: null,
                  label: t("fields.unassigned"),
                  icon: <Avatar avatar={null} size={18} placeholder />,
                },
                ...members.map((user) => ({
                  value: user.id,
                  label: fullName(user),
                  icon: <Avatar avatar={user} size={18} />,
                })),
              ]}
              value={issue.assignee}
              onPick={(value) => {
                onPatch({ assignee: value as string | null });
                close();
              }}
              onClose={close}
              searchable
            />
          )}
        </InlinePicker>
      </Row>

      <div className={styles.divider} />

      {/* Labels stehen unter ihrer Beschriftung statt daneben: mehrere Chips
          brauchen die volle Breite, sonst bricht schon das zweite um. */}
      <div className={styles.labels}>
        <div className={styles.labelsHead}>
          <span className={styles.rowLabel}>{t("fields.labels")}</span>
          <InlinePicker
            width={240}
            align="end"
            stop
            trigger={
              <button
                type="button"
                className={styles.iconBtn}
                aria-label={t("actions.addLabel")}
                title={t("actions.addLabel")}
              >
                <Icon icon="lucide:plus" width={14} />
              </button>
            }
          >
            {(close) => (
              <LabelPickerMenu
                allLabels={knownLabels}
                selected={issue.labels}
                projectId={issue.project}
                projectName={project?.name ?? ""}
                workspaceId={data.workspaceId}
                onPick={toggleLabel}
                onCreated={(label) =>
                  setCreatedLabels((cur) => [...cur, label])
                }
                onClose={close}
                keepOpen
              />
            )}
          </InlinePicker>
        </div>
        {issueLabels.length > 0 ? (
          <div className={styles.labelsList}>
            {issueLabels.map((label) => (
              <LabelChip key={label.id} color={label.color} size="sm">
                {label.name}
              </LabelChip>
            ))}
          </div>
        ) : (
          <span className={styles.labelsEmpty}>{t("fields.none")}</span>
        )}
      </div>

      <div className={styles.divider} />

      <Row label={t("fields.project")}>
        <span className={styles.value}>
          <span className="dot" style={{ background: project?.color }} />
          <span className={styles.valueText}>{project?.name ?? "—"}</span>
        </span>
      </Row>

      <Row label={t("fields.creator")}>
        <span className={styles.value}>
          <Avatar avatar={reporter} size={20} placeholder />
          <span className={styles.valueText}>
            {reporter ? fullName(reporter) : "—"}
          </span>
        </span>
      </Row>

      <Row label={t("fields.created")}>
        <span className={`${styles.value} ${styles.valueMuted}`}>
          {format.dateTime(issue.created, {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
      </Row>

      <Row label={t("fields.updated")}>
        <span
          className={`${styles.value} ${styles.valueMuted}`}
          title={format.dateTime(issue.updated, {
            dateStyle: "long",
            timeStyle: "short",
          })}
        >
          {timeAgo(issue.updated)}
        </span>
      </Row>
    </aside>
  );
}
