"use client";

import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/atoms/Avatar/Avatar";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { SelectMenu } from "@/components/ui/atoms/SelectMenu/SelectMenu";
import { useIssuePatch } from "@/features/issues/useIssuePatch";
import { fullName } from "@/lib/utils/string";
import type { IssueDetail, User } from "@/types";
import styles from "./assigneePicker.module.scss";

interface AssigneePickerProps {
  issue: IssueDetail;
  members: User[];
  /** Größe des Avatars — die Fläche zum Anklicken wächst mit ihm. */
  size?: number;
}

/**
 * Die Zuweisung eines Issues, dort geändert, wo sie steht: der Avatar ist der
 * Auslöser. Liste und Board teilen sich den Picker — an beiden Stellen zeigt
 * derselbe Avatar dieselbe Sache, also soll er sich auch gleich anfassen lassen.
 *
 * `stop` am `InlinePicker` ist hier keine Feinheit, sondern Bedingung: auf dem
 * Board sitzt der Avatar in einer Karte, die selbst auf Klicks reagiert.
 *
 * Ohne `issue.access.canAssign` (spiegelt `issue.assign` in `updateIssue`)
 * bleibt der Avatar ein reiner Anzeigewert — derselbe Grund wie bei der
 * Detailansicht (`IssueProperties.tsx`): der Server lehnte den Patch ohnehin ab.
 */
export function AssigneePicker({
  issue,
  members,
  size = 22,
}: AssigneePickerProps) {
  const t = useTranslations();
  const { patch } = useIssuePatch(issue.id);
  const assignee = issue.assignee
    ? (members.find((member) => member.id === issue.assignee) ?? null)
    : null;

  if (!issue.access.canAssign) {
    return (
      <span
        className={styles.trigger}
        data-readonly
        title={assignee ? fullName(assignee) : t("fields.unassigned")}
      >
        <Avatar avatar={assignee} size={size} placeholder />
      </span>
    );
  }

  return (
    <InlinePicker
      width={220}
      align="end"
      stop
      trigger={
        <button
          type="button"
          className={styles.trigger}
          title={assignee ? fullName(assignee) : t("fields.unassigned")}
          aria-label={t("fields.assignee")}
        >
          <Avatar avatar={assignee} size={size} placeholder />
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
            patch({ assignee: value as string | null });
            close();
          }}
          onClose={close}
          searchable
        />
      )}
    </InlinePicker>
  );
}
