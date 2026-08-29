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
   * `false` for external link attachments: the download button re-fetches
   * the file client-side as a blob (see below) — that requires CORS
   * clearance from the host, which holds for our own S3 bucket but isn't
   * guaranteed for an arbitrary foreign address. There, instead of
   * "Download" there's only "Open original".
   */
  downloadable: boolean;
  /** Already fully formatted (`useTimeAgo`) — the atom itself stays free of
   *  next-intl, like `LinkForm` and the rest of the `components/ui` building blocks. */
  addedAt: string;
  close: () => void;
  closeLabel: string;
  downloadLabel: string;
  downloadFailedLabel: string;
  openOriginalLabel: string;
  noPreviewLabel: string;
}

/**
 * Preview dialog for an attachment: image/video embedded directly, PDF via
 * `iframe`, everything else shown only as an icon with a note. The download
 * button first fetches the file as a blob and then triggers it through an
 * invisible anchor — an `<a download>` pointed directly at the presigned S3
 * URL would be ignored by the browser (the attribute only works for
 * same-origin or `blob:`/`data:`, not cross-origin), and the file would
 * otherwise just open in the tab.
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
            // biome-ignore lint/performance/noImgElement: presigned or external URL, next/image can't optimize it
            <img className={styles.image} src={url} alt={name} />
          ) : mimeType?.startsWith("video/") ? (
            // biome-ignore lint/a11y/useMediaCaption: no caption text available — user-generated file attachment
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
