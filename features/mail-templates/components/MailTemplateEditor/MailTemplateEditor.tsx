"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { Input } from "@/components/ui/atoms/Input/Input";
import { useConfirm } from "@/components/ui/layout/ConfirmDialog/ConfirmDialog";
import {
  resetMailTemplate,
  saveMailTemplate,
  sendTestMailTemplate,
} from "@/features/mail-templates/actions";
import { renderMailPreview } from "@/features/mail-templates/preview";
import type { MailTemplateRow } from "@/features/mail-templates/types";
import styles from "./mailTemplateEditor.module.scss";

interface Props {
  row: MailTemplateRow;
  defaultTestEmail: string;
}

const EMPTY = { subject: "", heading: "", bodyText: "" };

/**
 * Betreff, Überschrift und Einleitungstext einer Vorlage — mit Live-Vorschau.
 *
 * Ein leeres Feld fällt beim Rendern auf den Code-Default zurück
 * (`resolveText` in `lib/mail/templates/override.ts`): wer nur den Betreff
 * ändert, muss nicht auch Überschrift und Text abschreiben.
 */
export function MailTemplateEditor({ row, defaultTestEmail }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState(row.override ?? EMPTY);
  const [error, setError] = useState<string | null>(null);

  const [testEmail, setTestEmail] = useState(defaultTestEmail);
  const [isSendingTest, startTestTransition] = useTransition();
  const [testResult, setTestResult] = useState<
    { ok: true; to: string } | { error: string } | null
  >(null);

  const isDirty =
    draft.subject !== (row.override?.subject ?? "") ||
    draft.heading !== (row.override?.heading ?? "") ||
    draft.bodyText !== (row.override?.bodyText ?? "");

  const preview = renderMailPreview(
    row.key,
    draft.subject || draft.heading || draft.bodyText ? draft : undefined,
  );

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveMailTemplate(row.key, draft);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const reset = async () => {
    const ok = await confirm({
      title: "Vorlage zurücksetzen?",
      description: `„${row.meta.label}“ fällt zurück auf den Standardtext.`,
      confirmLabel: "Zurücksetzen",
      cancelLabel: "Abbrechen",
      danger: true,
    });
    if (!ok) return;

    startTransition(async () => {
      const result = await resetMailTemplate(row.key);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDraft(EMPTY);
      router.refresh();
    });
  };

  const sendTest = () => {
    setTestResult(null);
    startTestTransition(async () => {
      const result = await sendTestMailTemplate(row.key, draft, testEmail);
      setTestResult("error" in result ? result : { ok: true, to: testEmail });
    });
  };

  return (
    <div className={styles.editor}>
      <div className={styles.form}>
        <div className={styles.head}>
          <h2 className={styles.title}>{row.meta.label}</h2>
          {!row.meta.wired && (
            <span className={styles.unwired}>
              <Icon icon="lucide:info" width={13} />
              Noch nicht verdrahtet — diese Vorlage hat noch keinen
              Versandpunkt.
            </span>
          )}
        </div>

        <Input
          label="Betreff"
          placeholder="Standard verwenden"
          value={draft.subject}
          onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
        />
        <Input
          label="Überschrift"
          placeholder="Standard verwenden"
          value={draft.heading}
          onChange={(e) => setDraft({ ...draft, heading: e.target.value })}
        />
        <label className={styles.field}>
          <span className={styles.label}>Einleitungstext</span>
          <textarea
            className={styles.textarea}
            placeholder="Standard verwenden"
            rows={4}
            value={draft.bodyText}
            onChange={(e) => setDraft({ ...draft, bodyText: e.target.value })}
          />
        </label>

        <div className={styles.placeholders}>
          <span className={styles.label}>Verfügbare Platzhalter</span>
          <div className={styles.chips}>
            {row.meta.placeholders.map((p) => (
              <code key={p.key} className={styles.chip} title={p.description}>
                {`{{${p.key}}}`}
              </code>
            ))}
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <Button
            variant="primary"
            onClick={save}
            disabled={!isDirty || isPending}
          >
            Speichern
          </Button>
          <Button
            variant="text"
            onClick={reset}
            disabled={isPending || (!row.override && !isDirty)}
          >
            Auf Standard zurücksetzen
          </Button>
        </div>
      </div>

      <div className={styles.previewPane}>
        <div className={styles.previewHead}>
          <span className={styles.label}>Vorschau — Beispieldaten</span>
          <div className={styles.testSend}>
            <Input
              size="sm"
              inputMode="email"
              aria-label="Adresse für Testmail"
              placeholder="du@example.com"
              className={styles.testInput}
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              className={styles.testSendButton}
              onClick={sendTest}
              disabled={isSendingTest || !testEmail}
            >
              Testmail senden
            </Button>
          </div>
        </div>
        {testResult && (
          <p
            className={
              "error" in testResult ? styles.error : styles.testSuccess
            }
          >
            {"error" in testResult
              ? testResult.error
              : `Testmail an ${testResult.to} verschickt.`}
          </p>
        )}
        <iframe
          key={row.key}
          title={`Vorschau: ${row.meta.label}`}
          srcDoc={preview.html}
          className={styles.preview}
        />
      </div>
    </div>
  );
}
