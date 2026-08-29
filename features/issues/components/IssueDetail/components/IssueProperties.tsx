"use client";

import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import {
  PriorityIcon,
  StatusIcon,
  TypeIcon,
} from "@/features/issues/components/IssueIcons/IssueIcons";
import type { IssueComposerData, IssuePatch } from "@/features/issues/types";
import { fullName } from "@/lib/utils/string";
import type { IssueDetail } from "@/types";
import styles from "../issueDetail.module.scss";
import type { IssueDetailLayout } from "../types";

interface IssuePropertiesProps {
  issue: IssueDetail;
  data: IssueComposerData;
  layout: IssueDetailLayout;
  onPatch: (patch: IssuePatch) => void;
}

/**
 * A labeled attribute. In the main column, the label sits above the value
 * (the bar should stay flat), in the attributes sidebar it sits next to it
 * (there, width is scarce, height is not).
 */
function Field({
  label,
  layout,
  children,
}: {
  label: string;
  layout: IssueDetailLayout;
  children: React.ReactNode;
}) {
  if (layout === "aside") {
    return (
      <div className={styles.row}>
        <span className={styles.rowLabel}>{label}</span>
        <div className={styles.rowValue}>{children}</div>
      </div>
    );
  }

  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

/**
 * The same value, without a button: no click opens a menu, no focus ring.
 * For fields that `IssueAccess` currently forbids — the server would reject
 * the patch anyway (`updateIssue`), this just leaves out the invitation to
 * try.
 */
function ValueDisplay({ children }: { children: React.ReactNode }) {
  return <span className={styles.valueBtn}>{children}</span>;
}

/**
 * The four attributes that change most often on an issue — type, status,
 * priority, assignee.
 *
 * In the main column they form their own bar directly below the title:
 * that's the only place there where they're visible without first
 * scrolling past the description. Side by side rather than stacked, so the
 * block stays flat. In the two-column view they're the header of the
 * attributes sidebar and appear as stacked rows.
 */
export function IssueProperties({
  issue,
  data,
  layout,
  onPatch,
}: IssuePropertiesProps) {
  const { members, statuses, priorities, issueTypes } = data;
  const t = useTranslations();
  const { canEdit, canAssign } = issue.access;

  const type = issueTypes.find((x) => x.id === issue.type);
  const status = statuses.find((s) => s.id === issue.status);
  const priority = priorities.find((p) => p.id === issue.priority);
  const assignee = issue.assignee
    ? (members.find((m) => m.id === issue.assignee) ?? null)
    : null;

  return (
    <div className={layout === "aside" ? undefined : styles.properties}>
      <Field label={t("fields.type")} layout={layout}>
        {canEdit ? (
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
        ) : (
          <ValueDisplay>
            <TypeIcon type={issue.type} size={14} color={type?.color} />
            <span className={styles.valueText}>{type?.name ?? issue.type}</span>
          </ValueDisplay>
        )}
      </Field>

      <Field label={t("fields.status")} layout={layout}>
        {canEdit ? (
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
        ) : (
          <ValueDisplay>
            <StatusIcon status={issue.status} size={14} color={status?.color} />
            <span className={styles.valueText}>
              {status?.name ?? issue.status}
            </span>
          </ValueDisplay>
        )}
      </Field>

      <Field label={t("fields.priority")} layout={layout}>
        {canEdit ? (
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
        ) : (
          <ValueDisplay>
            <PriorityIcon priority={issue.priority} size={14} />
            <span className={styles.valueText}>
              {priority?.name ?? String(issue.priority)}
            </span>
          </ValueDisplay>
        )}
      </Field>

      <Field label={t("fields.assignee")} layout={layout}>
        {canAssign ? (
          <InlinePicker
            width={220}
            align="end"
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
        ) : (
          <ValueDisplay>
            <Avatar avatar={assignee} size={20} placeholder />
            <span className={styles.valueText}>
              {assignee ? fullName(assignee) : t("fields.unassigned")}
            </span>
          </ValueDisplay>
        )}
      </Field>
    </div>
  );
}
