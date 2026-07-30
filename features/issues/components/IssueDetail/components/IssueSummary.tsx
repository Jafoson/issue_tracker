"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { EditableMarkdown } from "@/components/ui/atoms/EditableMarkdown/EditableMarkdown";
import { EditableText } from "@/components/ui/atoms/EditableText/EditableText";
import type { IssuePatch } from "@/features/issues/types";
import styles from "../issueDetail.module.scss";

interface IssueSummaryProps {
  title: string;
  description: string;
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
        <EditableMarkdown
          className={styles.description}
          value={description}
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
