"use client";

import { Icon } from "@iconify/react";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { formatBytes } from "@/lib/richtext/attachments";
import styles from "./attachmentView.module.scss";

/**
 * Ein Anhang im Editor: Bild-Vorschau, Video-Player oder Datei-Karte, je nach
 * `mimeType` — dieselbe Verzweigung wie in `RichText.tsx`s `case "attachment"`,
 * hier nur zusätzlich mit einer Entfernen-Schaltfläche.
 *
 * Fehlt `url` (Anhang wurde gelöscht, aber der Knoten steht noch im
 * Dokument einer älteren Fassung), erscheint ein stiller Platzhalter statt
 * eines toten Bildes.
 */
export function AttachmentView({ node, extension, deleteNode }: NodeViewProps) {
  const t = useTranslations("editor");
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const id = node.attrs.id as string | null;
  const url = node.attrs.url as string | null;
  const name = (node.attrs.name as string) || "";
  const mimeType = node.attrs.mimeType as string | null;
  const size = node.attrs.size as number | null;
  const onRemove = extension.options.onRemove as
    | ((id: string) => Promise<void>)
    | null;

  const remove = async () => {
    if (!id || !onRemove || isRemoving) return;
    setIsRemoving(true);
    setError(null);
    try {
      await onRemove(id);
      deleteNode();
    } catch {
      setError(t("attachmentRemoveError"));
      setIsRemoving(false);
    }
  };

  const removeButton = onRemove && (
    <button
      type="button"
      className={styles.remove}
      contentEditable={false}
      disabled={isRemoving}
      aria-label={t("attachmentRemove")}
      title={t("attachmentRemove")}
      onClick={remove}
    >
      <Icon icon="lucide:x" width={13} />
    </button>
  );

  if (!url) {
    return (
      <NodeViewWrapper className={styles.missing} contentEditable={false}>
        <Icon icon="lucide:file-x" width={15} aria-hidden="true" />
        <span>{t("attachmentRemoved")}</span>
      </NodeViewWrapper>
    );
  }

  if (mimeType?.startsWith("image/")) {
    return (
      <NodeViewWrapper className={styles.image} contentEditable={false}>
        {/* biome-ignore lint/performance/noImgElement: presignte URL, next/image kann sie nicht optimieren */}
        <img src={url} alt={name} className={styles.imagePreview} />
        <div className={styles.caption}>
          <span className={styles.name}>{name}</span>
          {size != null && (
            <span className={styles.size}>{formatBytes(size)}</span>
          )}
        </div>
        {removeButton}
        {error && <span className={styles.error}>{error}</span>}
      </NodeViewWrapper>
    );
  }

  if (mimeType?.startsWith("video/")) {
    return (
      <NodeViewWrapper className={styles.video} contentEditable={false}>
        {/* biome-ignore lint/a11y/useMediaCaption: hochgeladene Anhänge tragen keine Untertitel */}
        <video src={url} controls className={styles.videoPlayer} />
        <div className={styles.caption}>
          <span className={styles.name}>{name}</span>
          {size != null && (
            <span className={styles.size}>{formatBytes(size)}</span>
          )}
        </div>
        {removeButton}
        {error && <span className={styles.error}>{error}</span>}
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className={styles.file} contentEditable={false}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.fileLink}
      >
        <Icon icon="lucide:file" width={18} aria-hidden="true" />
        <span className={styles.name}>{name}</span>
        {size != null && (
          <span className={styles.size}>{formatBytes(size)}</span>
        )}
      </a>
      {removeButton}
      {error && <span className={styles.error}>{error}</span>}
    </NodeViewWrapper>
  );
}
