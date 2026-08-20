"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { type DragEvent, useRef, useState } from "react";
import { InlinePicker } from "@/components/ui/atoms/InlinePicker/InlinePicker";
import { LinkForm } from "@/components/ui/layout/RichTextEditor/components/LinkForm/LinkForm";
import {
  addIssueLinkAttachment,
  deleteIssueAttachment,
} from "@/features/issues/actions";
import { uploadIssueAttachment } from "@/features/issues/uploadAttachment";
import { formatBytes } from "@/lib/richtext/attachments";
import { faviconOf } from "@/lib/richtext/link";
import type { IssueAttachment } from "@/types";
import styles from "../issueDetail.module.scss";

interface IssueAttachmentsProps {
  issueId: string;
  attachments: IssueAttachment[];
  readOnly?: boolean;
  /** Holt das Issue neu — Uploads/Löschen laufen über eigene Server Actions,
   *  das Panel hängt an keinem Server-Render (`useIssueDetail`). */
  onRefresh: () => Promise<void>;
}

/** Symbol für die Kachel-Vorschau, wenn keine echte Miniatur möglich ist —
 *  eine PDF bekommt wenigstens ein eigenes Zeichen statt des generischen. */
function iconFor(mimeType: string | null): string {
  if (mimeType === "application/pdf") return "lucide:file-text";
  if (mimeType?.startsWith("video/")) return "lucide:film";
  if (mimeType?.startsWith("audio/")) return "lucide:file-audio";
  return "lucide:file";
}

/** Vorschau einer einzelnen Kachel: echtes Bild bei einem Bild-Anhang, das
 *  Favicon der Seite bei einem Link (dieselbe Herleitung wie beim Link-Chip
 *  im Editor, `lib/richtext/link.ts`), sonst ein Symbol nach Art der Datei. */
function TilePreview({ a }: { a: IssueAttachment }) {
  if (a.kind === "file" && a.mimeType?.startsWith("image/") && a.url) {
    // biome-ignore lint/performance/noImgElement: presignte URL, next/image kann sie nicht optimieren
    return <img src={a.url} alt="" />;
  }
  const favicon = a.kind === "link" ? faviconOf(a.url ?? "") : null;
  if (favicon) {
    return (
      <span
        className={styles.attachmentTileFavicon}
        style={{ "--favicon": `url("${favicon}")` } as React.CSSProperties}
      />
    );
  }
  return (
    <Icon
      icon={a.kind === "link" ? "lucide:link" : iconFor(a.mimeType)}
      width={22}
      aria-hidden="true"
    />
  );
}

export function IssueAttachments({
  issueId,
  attachments,
  readOnly,
  onRefresh,
}: IssueAttachmentsProps) {
  const t = useTranslations();
  const [tab, setTab] = useState<"file" | "link">("file");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rows = attachments.filter((a) => a.kind === tab);
  const canAdd = !readOnly;
  const isEmpty = rows.length === 0;

  const upload = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const result = await uploadIssueAttachment(issueId, file);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  /** Mehrere fallen gelassene Dateien nacheinander — ein gleichzeitiger Start
   *  brächte nur mehrere Ladeanzeigen ohne echten Vorteil. */
  const uploadAll = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) await upload(file);
  };

  const addLink = async (href: string, name: string, close: () => void) => {
    setError(null);
    setBusy(true);
    try {
      const result = await addIssueLinkAttachment(issueId, {
        url: href,
        name,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      close();
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    setBusy(true);
    try {
      const result = await deleteIssueAttachment(issueId, id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (tab !== "file" || !canAdd) return;
    if (e.dataTransfer.files.length) uploadAll(e.dataTransfer.files);
  };

  const linkForm = (close: () => void) => (
    <LinkForm
      withName
      onSubmit={(href, name) => addLink(href, name, close)}
      onCancel={close}
      label={t("editor.link")}
      placeholder={t("editor.linkPlaceholder")}
      nameLabel={t("editor.linkName")}
      namePlaceholder={t("editor.linkNamePlaceholder")}
      applyLabel={t("editor.linkApply")}
      removeLabel={t("editor.linkRemove")}
    />
  );

  return (
    <section className={styles.section}>
      <header className={styles.sectionHead}>
        <Icon icon="lucide:paperclip" width={15} aria-hidden="true" />
        <h3 className={styles.sectionTitle}>{t("attachments.title")}</h3>
      </header>

      <div className={styles.attachmentTabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "file"}
          className={styles.attachmentTab}
          data-active={tab === "file" ? "" : undefined}
          onClick={() => setTab("file")}
        >
          {t("attachments.files")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "link"}
          className={styles.attachmentTab}
          data-active={tab === "link" ? "" : undefined}
          onClick={() => setTab("link")}
        >
          {t("attachments.links")}
        </button>
      </div>

      {/* Eine Box für beides: Drag&Drop-Ziel bei „Dateien" (auf eine Adresse
          lässt sich nichts fallen) und die Kachel-Übersicht des Reiters. Leer
          ist sie selbst schon die Aufforderung, statt nur eine Fehlanzeige
          zu zeigen. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Drag&Drop-Ziel — die eigentliche Bedienung sitzt in den Kacheln/Knöpfen darin */}
      <div
        className={styles.attachmentBox}
        data-drag-over={dragOver ? "" : undefined}
        onDragOver={(e) => {
          if (tab !== "file" || !canAdd) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {isEmpty ? (
          canAdd ? (
            tab === "file" ? (
              <button
                type="button"
                className={styles.attachmentEmptyAction}
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon icon="lucide:upload" width={20} aria-hidden="true" />
                <span>{t("attachments.dropHintFiles")}</span>
              </button>
            ) : (
              <InlinePicker
                width={280}
                align="start"
                stop
                trigger={
                  <button
                    type="button"
                    className={styles.attachmentEmptyAction}
                    disabled={busy}
                  >
                    <Icon icon="lucide:link" width={20} aria-hidden="true" />
                    <span>{t("attachments.dropHintLinks")}</span>
                  </button>
                }
              >
                {linkForm}
              </InlinePicker>
            )
          ) : (
            <span className={styles.attachmentEmpty}>
              {t(
                tab === "file"
                  ? "attachments.emptyFiles"
                  : "attachments.emptyLinks",
              )}
            </span>
          )
        ) : (
          <div className={styles.attachmentGrid}>
            {rows.map((a) => (
              <div key={a.id} className={styles.attachmentTile}>
                <a
                  href={a.url ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.attachmentTileVisual}
                  title={a.name}
                  onClick={(e) => {
                    if (!a.url) e.preventDefault();
                  }}
                >
                  <TilePreview a={a} />
                </a>
                <div className={styles.attachmentTileCaption} title={a.name}>
                  <span>{a.name}</span>
                  {a.size != null && (
                    <span className={styles.attachmentTileSize}>
                      {formatBytes(a.size)}
                    </span>
                  )}
                </div>
                {canAdd && (
                  <button
                    type="button"
                    className={styles.attachmentTileRemove}
                    disabled={busy}
                    aria-label={t("attachments.remove")}
                    title={t("attachments.remove")}
                    onClick={() => remove(a.id)}
                  >
                    <Icon icon="lucide:x" width={12} />
                  </button>
                )}
              </div>
            ))}

            {canAdd &&
              (tab === "file" ? (
                <button
                  type="button"
                  className={styles.attachmentTileAdd}
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Icon icon="lucide:plus" width={18} aria-hidden="true" />
                  <span>{t("attachments.add")}</span>
                </button>
              ) : (
                <InlinePicker
                  width={280}
                  align="start"
                  stop
                  trigger={
                    <button
                      type="button"
                      className={styles.attachmentTileAdd}
                      disabled={busy}
                    >
                      <Icon icon="lucide:plus" width={18} aria-hidden="true" />
                      <span>{t("attachments.addLink")}</span>
                    </button>
                  }
                >
                  {linkForm}
                </InlinePicker>
              ))}
          </div>
        )}
      </div>

      {canAdd && (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          disabled={busy}
          onChange={(e) => {
            // `Array.from` statt der `FileList` selbst: die ist an den
            // Eingabewert gebunden — sobald `value` unten geleert wird,
            // liest ein späterer Zugriff auf dieselbe Liste bereits leer.
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) uploadAll(files);
          }}
        />
      )}

      {error && (
        <p className={styles.attachmentError} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
