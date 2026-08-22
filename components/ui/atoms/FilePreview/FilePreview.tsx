"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";
import { Button } from "@/components/ui/atoms/Button/Button";
import { ModalFooter } from "@/components/ui/layout/Modal/components/ModalFooter";
import { ModalHeader } from "@/components/ui/layout/Modal/components/ModalHeader";
import { Modal, ModalBody } from "@/components/ui/layout/Modal/Modal";
import { formatBytes, iconForMimeType } from "@/lib/richtext/attachments";
import styles from "./filePreview.module.scss";

interface FilePreviewProps {
  url: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  /**
   * `false` bei externen Link-Anhängen: der Download-Knopf lädt die Datei
   * client-seitig als Blob nach (siehe unten) — das braucht CORS-Freigabe
   * vom Host, die für den eigenen S3-Bucket gilt, für eine beliebige fremde
   * Adresse aber nicht garantiert ist. Dort gibt es statt „Herunterladen"
   * nur „Original öffnen".
   */
  downloadable: boolean;
  /** Schon fertig formatiert (`useTimeAgo`) — der Atom selbst bleibt ohne
   *  next-intl, wie `LinkForm` und die übrigen `components/ui`-Bausteine. */
  addedAt: string;
  close: () => void;
  closeLabel: string;
  downloadLabel: string;
  downloadFailedLabel: string;
  openOriginalLabel: string;
  noPreviewLabel: string;
}

/**
 * Vorschau-Dialog für einen Anhang: Bild/Video direkt eingebettet, PDF per
 * `iframe`, alles andere nur als Symbol mit Hinweis. Der Download-Knopf lädt
 * die Datei erst als Blob und löst ihn dann über einen unsichtbaren Anker
 * aus — ein `<a download>` direkt auf die presignte S3-Adresse würde vom
 * Browser ignoriert (das Attribut wirkt nur bei gleicher Herkunft oder
 * `blob:`/`data:`, nicht cross-origin), die Datei liefe sonst nur im Tab auf.
 */
export function FilePreview({
  url,
  name,
  mimeType,
  size,
  downloadable,
  addedAt,
  close,
  closeLabel,
  downloadLabel,
  downloadFailedLabel,
  openOriginalLabel,
  noPreviewLabel,
}: FilePreviewProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  const download = async () => {
    setDownloadError(false);
    setDownloading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal width={640}>
      <ModalHeader
        leading={<Icon icon={iconForMimeType(mimeType)} width={16} />}
        title={name}
        onClose={close}
        closeLabel={closeLabel}
      />

      <ModalBody>
        <div className={styles.preview}>
          {mimeType?.startsWith("image/") ? (
            // biome-ignore lint/performance/noImgElement: presignte bzw. externe Adresse, next/image kann sie nicht optimieren
            <img className={styles.image} src={url} alt={name} />
          ) : mimeType?.startsWith("video/") ? (
            // biome-ignore lint/a11y/useMediaCaption: kein Untertitel-Text zur Hand — nutzergenerierter Datei-Anhang
            <video className={styles.video} src={url} controls />
          ) : mimeType === "application/pdf" ? (
            <iframe className={styles.pdf} src={url} title={name} />
          ) : (
            <div className={styles.fallback}>
              <Icon icon={iconForMimeType(mimeType)} width={40} />
              <span>{noPreviewLabel}</span>
            </div>
          )}
        </div>

        <p className={styles.meta}>{addedAt}</p>
        {size != null && <p className={styles.meta}>{formatBytes(size)}</p>}
        {downloadError && (
          <p className={styles.error} role="alert">
            {downloadFailedLabel}
          </p>
        )}
      </ModalBody>

      <ModalFooter>
        {downloadable ? (
          <Button
            variant="primary"
            onClick={download}
            disabled={downloading}
            icon={<Icon icon="lucide:download" width={15} />}
          >
            {downloadLabel}
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            icon={<Icon icon="lucide:external-link" width={15} />}
          >
            {openOriginalLabel}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
