"use client";

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import {
  Avatar,
  type AvatarData,
  type AvatarShape,
} from "@/components/ui/atoms/Avatar/Avatar";
import { Button } from "@/components/ui/atoms/Button/Button";
import {
  AVATAR_MAX_BYTES,
  AVATAR_MIME_EXTENSIONS,
} from "@/lib/storage/validation";
import styles from "./avatarUploader.module.scss";

type UploadUrlResult =
  | { ok: true; key: string; uploadUrl: string }
  | { error: string };
type ActionResult = { ok: true } | { error: string };

interface AvatarUploaderProps {
  avatar: AvatarData | null;
  size?: number;
  shape?: AvatarShape;
  disabled?: boolean;
  /** Label for the remove button, e.g. "Remove profile picture" —
   *  domain-specific, so it's passed in from outside rather than hardcoded
   *  here. Defaults to a neutral "Remove" when omitted. */
  removeLabel?: string;
  /** First step: the server validates permissions/mime type/size and issues
   *  a presigned PUT URL. */
  onRequestUpload: (input: {
    contentType: string;
    contentLength: number;
  }) => Promise<UploadUrlResult>;
  /** Second step: after uploading directly to S3, persist the key in the
   *  DB. */
  onConfirmUpload: (key: string) => Promise<ActionResult>;
  onRemove?: () => Promise<ActionResult>;
  /** Runs after a successful upload/removal — typically `router.refresh()`,
   *  since the new image URL comes from the server. */
  onDone?: () => void;
}

/**
 * Domain-free file upload for avatars (`components/ui` knows nothing about
 * Workspace or Prisma) — feature components pass in the appropriate
 * server actions as props. Uploads directly against the presigned URL
 * (browser → S3), not through the server.
 */
export function AvatarUploader({
  avatar,
  size = 156,
  shape,
  disabled,
  removeLabel,
  onRequestUpload,
  onConfirmUpload,
  onRemove,
  onDone,
}: AvatarUploaderProps) {
  const t = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const hasImage = Boolean(avatar && "image" in avatar && avatar.image);
  const inactive = disabled || busy;

  async function handleFile(file: File) {
    setError("");
    if (!(file.type in AVATAR_MIME_EXTENSIONS)) {
      setError(t("avatarUploader.invalidType"));
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError(t("avatarUploader.tooLarge"));
      return;
    }

    setBusy(true);
    try {
      const requested = await onRequestUpload({
        contentType: file.type,
        contentLength: file.size,
      });
      if ("error" in requested) {
        setError(requested.error);
        return;
      }

      let put: Response;
      try {
        put = await fetch(requested.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
      } catch {
        // Network error, CORS rejection by the bucket, etc. — `fetch`
        // throws in these cases instead of returning a response with an
        // error status.
        setError(t("avatarUploader.uploadFailed"));
        return;
      }
      if (!put.ok) {
        setError(t("avatarUploader.uploadFailed"));
        return;
      }

      const confirmed = await onConfirmUpload(requested.key);
      if ("error" in confirmed) {
        setError(confirmed.error);
        return;
      }

      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!onRemove) return;
    setError("");
    setBusy(true);
    try {
      const result = await onRemove();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.trigger}
        disabled={inactive}
        onClick={() => inputRef.current?.click()}
        aria-label={t("avatarUploader.change")}
      >
        <Avatar avatar={avatar} size={size} shape={shape} />
        <span className={styles.overlay} aria-hidden>
          {/* Changing an existing image vs. adding one for the first time are
              different actions and deserve different icons: pencil only
              where there's something to edit. */}
          <Icon
            icon={hasImage ? "lucide:pencil" : "lucide:camera"}
            width={Math.round(size * (hasImage ? 0.24 : 0.3))}
          />
        </span>
      </button>
      {onRemove && hasImage && !disabled && (
        <Button
          type="button"
          variant="elevated"
          size="sm"
          disabled={busy}
          onClick={handleRemove}
        >
          {removeLabel ?? t("actions.remove")}
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={Object.keys(AVATAR_MIME_EXTENSIONS).join(",")}
        hidden
        disabled={inactive}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) handleFile(file);
        }}
      />
      {error && (
        <p className={styles.error} role="alert">
          <Icon icon="lucide:circle-alert" width={14} />
          {error}
        </p>
      )}
    </div>
  );
}
