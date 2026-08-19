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
  /** Beschriftung des Entfernen-Knopfs, z. B. „Profilbild entfernen" —
   *  domänenspezifisch, deshalb von außen statt fest hier drin. Ohne Angabe
   *  ein neutrales „Entfernen". */
  removeLabel?: string;
  /** Erster Schritt: Server validiert Rechte/Mime/Größe und stellt eine
   *  presigned PUT-URL aus. */
  onRequestUpload: (input: {
    contentType: string;
    contentLength: number;
  }) => Promise<UploadUrlResult>;
  /** Zweiter Schritt: nach dem direkten Upload gegen S3 den Key in der DB
   *  hinterlegen. */
  onConfirmUpload: (key: string) => Promise<ActionResult>;
  onRemove?: () => Promise<ActionResult>;
  /** Läuft nach einem erfolgreichen Upload/Entfernen — üblicherweise
   *  `router.refresh()`, da die neue Bild-URL vom Server kommt. */
  onDone?: () => void;
}

/**
 * Domänenfreier Datei-Upload für Avatare (`components/ui` kennt weder
 * Workspace noch Prisma) — Feature-Komponenten reichen die passenden
 * Server-Actions als Props herein. Lädt direkt gegen die presigned URL
 * (Browser → S3), nicht über den Server.
 */
export function AvatarUploader({
  avatar,
  size = 140,
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
        // Netzwerkfehler, CORS-Ablehnung durch den Bucket, o.ä. — `fetch`
        // wirft in diesen Fällen statt eine Antwort mit Fehlerstatus zu
        // liefern.
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
          {/* Ändern eines vorhandenen Bildes vs. erstmaliges Hinzufügen sind
              unterschiedliche Handlungen und verdienen unterschiedliche
              Symbole: Stift nur, wo es etwas zu bearbeiten gibt. */}
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
