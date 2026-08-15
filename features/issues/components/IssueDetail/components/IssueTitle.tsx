"use client";

import { useTranslations } from "next-intl";
import { EditableText } from "@/components/ui/layout/EditableText/EditableText";
import type { IssuePatch } from "@/features/issues/types";
import styles from "../issueDetail.module.scss";

interface IssueTitleProps {
  title: string;
  /** `!issue.access.canEdit` — ohne `issue.update.any`/`.own` nur Text, kein Feld. */
  readOnly?: boolean;
  onPatch: (patch: IssuePatch) => void;
}

/** Der Titel — direkt im Fluss bearbeitbar, nicht über ein eigenes Formular. */
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
