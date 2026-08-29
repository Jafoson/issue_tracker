"use client";

import { useTranslations } from "next-intl";
import { EditableText } from "@/components/ui/layout/EditableText/EditableText";
import type { IssuePatch } from "@/features/issues/types";
import styles from "../issueDetail.module.scss";

interface IssueTitleProps {
  title: string;
  /** `!issue.access.canEdit` — without `issue.update.any`/`.own`, plain text, no field. */
  readOnly?: boolean;
  onPatch: (patch: IssuePatch) => void;
}

/** The title — editable directly inline, not through a separate form. */
export function IssueTitle({ title, readOnly, onPatch }: IssueTitleProps) {
  const t = useTranslations();

  return (
    <EditableText
      className={styles.title}
      value={title}
      label={t("fields.title")}
      placeholder={t("placeholders.issueTitle")}
      saveLabel={t("actions.save")}
      cancelLabel={t("actions.cancel")}
      singleLine
      readOnly={readOnly}
      onCommit={(value) => onPatch({ title: value })}
    />
  );
}
