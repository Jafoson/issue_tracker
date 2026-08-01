"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { IssueRichText } from "@/features/issues/components/IssueRichText/IssueRichText";
import type { IssueEditorData, IssuePatch } from "@/features/issues/types";
import type { PMDoc } from "@/lib/richtext/types";
import styles from "../issueDetail.module.scss";

interface IssueDescriptionProps {
  description: PMDoc;
  /** Für die Vorschläge hinter `@` und `#` im Beschreibungstext. */
  data: IssueEditorData;
  onPatch: (patch: IssuePatch) => void;
}

/**
 * Die Beschreibung, direkt im Fluss bearbeitbar. Ihr Abschnittskopf bleibt
 * auch ohne Inhalt stehen — sonst gäbe es keinen Ort, an dem sie entstehen
 * könnte.
 */
export function IssueDescription({
  description,
  data,
  onPatch,
}: IssueDescriptionProps) {
  const t = useTranslations();

  return (
    <section className={styles.section}>
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
  );
}
