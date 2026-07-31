"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { EditableText } from "@/components/ui/atoms/EditableText/EditableText";
import { IssueRichText } from "@/features/issues/components/IssueRichText/IssueRichText";
import type { IssueEditorData, IssuePatch } from "@/features/issues/types";
import type { PMDoc } from "@/lib/richtext/types";
import styles from "../issueDetail.module.scss";

interface IssueSummaryProps {
  title: string;
  description: PMDoc;
  /** Für die Vorschläge hinter `@` und `#` im Beschreibungstext. */
  data: IssueEditorData;
  onPatch: (patch: IssuePatch) => void;
}

/**
 * Titel und Beschreibung — beide direkt im Fluss bearbeitbar. Die Beschreibung
 * behält ihren Abschnittskopf auch ohne Inhalt, sonst gäbe es keinen Ort, an
 * dem sie entstehen könnte.
 */
export function IssueSummary({
  title,
  description,
  data,
  onPatch,
}: IssueSummaryProps) {
  const t = useTranslations();

  return (
    <>
      <EditableText
        className={styles.title}
        value={title}
        label={t("fields.title")}
        placeholder={t("placeholders.issueTitle")}
        saveLabel={t("actions.save")}
        cancelLabel={t("actions.cancel")}
        singleLine
        onCommit={(value) => onPatch({ title: value })}
      />

      <section className={styles.descriptionBlock}>
        <header className={styles.sectionHead}>
          <Icon icon="lucide:align-left" width={15} aria-hidden="true" />
          <h3 className={styles.sectionTitle}>{t("fields.description")}</h3>
        </header>
        <IssueRichText
          className={styles.description}
          value={description}
          data={data}
          label={t("fields.description")}
          placeholder={t("placeholders.editDescription")}
          saveLabel={t("actions.save")}
          cancelLabel={t("actions.cancel")}
          onCommit={(value) => onPatch({ description: value })}
        />
      </section>
    </>
  );
}
