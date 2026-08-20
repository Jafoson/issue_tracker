"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { deleteIssueAttachment } from "@/features/issues/actions";
import { IssueRichText } from "@/features/issues/components/IssueRichText/IssueRichText";
import type { IssueEditorData, IssuePatch } from "@/features/issues/types";
import { uploadIssueAttachment } from "@/features/issues/uploadAttachment";
import type { PMDoc } from "@/lib/richtext/types";
import styles from "../issueDetail.module.scss";

interface IssueDescriptionProps {
  issueId: string;
  description: PMDoc;
  /** Für die Vorschläge hinter `@` und `#` im Beschreibungstext. */
  data: IssueEditorData;
  /** `!issue.access.canEdit` — ohne `issue.update.any`/`.own` nur Anzeige, kein Editor. */
  readOnly?: boolean;
  onPatch: (patch: IssuePatch) => void;
  /**
   * Holt das Issue neu — ein Anhang-Upload/-Löschen läuft über eigene Server
   * Actions statt `onPatch`, das Panel hängt an keinem Server-Render und muss
   * darüber vom neuen Stand erfahren (`useIssueDetail`).
   */
  onRefresh: () => Promise<void>;
}

/**
 * Die Beschreibung, direkt im Fluss bearbeitbar. Ihr Abschnittskopf bleibt
 * auch ohne Inhalt stehen — sonst gäbe es keinen Ort, an dem sie entstehen
 * könnte.
 */
export function IssueDescription({
  issueId,
  description,
  data,
  readOnly,
  onPatch,
  onRefresh,
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
        readOnly={readOnly}
        onCommit={(value) => onPatch({ description: value })}
        onUploadAttachment={
          readOnly
            ? undefined
            : async (file) => {
                const result = await uploadIssueAttachment(issueId, file);
                if ("error" in result) return result;
                const { attachment } = result;
                if (!attachment.url) {
                  return { error: t("editor.attachmentUploadFailed") };
                }
                // Nicht abwarten: der Knoten soll sofort erscheinen, die
                // Anhänge-Sektion zieht kurz danach nach.
                onRefresh();
                return {
                  id: attachment.id,
                  url: attachment.url,
                  name: attachment.name,
                  mimeType: attachment.mimeType,
                  size: attachment.size,
                };
              }
        }
        onRemoveAttachment={
          readOnly
            ? undefined
            : async (id) => {
                const result = await deleteIssueAttachment(issueId, id);
                if ("error" in result) throw new Error(result.error);
                onRefresh();
              }
        }
      />
    </section>
  );
}
