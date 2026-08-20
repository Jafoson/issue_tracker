import "server-only";
import { storageConfig } from "@/lib/storage/config";
import {
  attachmentObjectKey,
  isOwnAttachmentKey,
  sanitizeAttachmentExt,
} from "@/lib/storage/keys";
import {
  deleteObjectSafely,
  objectExists,
  presignGetUrl,
  presignPutUrl,
} from "@/lib/storage/presign";
import { ATTACHMENT_MAX_BYTES } from "@/lib/storage/validation";

export type RequestAttachmentUploadResult =
  | { ok: true; key: string; uploadUrl: string }
  | { error: string };

/**
 * Wie `requestAvatarUpload`, nur ohne MIME-Allowlist — jeder Dateityp ist
 * erlaubt, nur die Größe wird begrenzt. RBAC (Berechtigung, das Issue zu
 * bearbeiten) bleibt außerhalb dieser Datei, in `features/issues/actions.ts`.
 */
export async function requestAttachmentUpload(input: {
  issueId: string;
  fileName: string;
  contentType: string;
  contentLength: number;
}): Promise<RequestAttachmentUploadResult> {
  const config = storageConfig();
  if (!config?.bucketIssues) {
    return { error: "Attachment uploads are not configured." };
  }
  if (input.contentLength > ATTACHMENT_MAX_BYTES) {
    return { error: "File is too large (max. 100 MB)." };
  }

  const ext = sanitizeAttachmentExt(input.fileName);
  const key = attachmentObjectKey(input.issueId, ext);
  const uploadUrl = await presignPutUrl(config.bucketIssues, key, {
    contentType: input.contentType,
  });
  if (!uploadUrl) return { error: "Attachment uploads are not configured." };

  return { ok: true, key, uploadUrl };
}

export type FinalizeAttachmentUploadResult =
  | { ok: true; size: number }
  | { error: string };

/**
 * Bestätigt einen Upload nach dem direkten PUT gegen S3 — prüft Eigentum am
 * Key (gegen manipulierte Keys aus dem Client), dass das Objekt existiert,
 * und liest die tatsächliche Größe aus (nicht die vom Client behauptete).
 */
export async function finalizeAttachmentUpload(
  issueId: string,
  key: string,
): Promise<FinalizeAttachmentUploadResult> {
  if (!isOwnAttachmentKey(issueId, key)) {
    return { error: "Invalid upload key." };
  }

  const config = storageConfig();
  if (!config?.bucketIssues) {
    return { error: "Attachment uploads are not configured." };
  }

  const head = await objectExists(config.bucketIssues, key);
  if (!head.exists) return { error: "Upload not found — please try again." };
  if (head.size > ATTACHMENT_MAX_BYTES) {
    await deleteObjectSafely(config.bucketIssues, key);
    return { error: "File is too large (max. 100 MB)." };
  }

  return { ok: true, size: head.size };
}

export async function deleteAttachmentObject(
  key: string | null | undefined,
): Promise<void> {
  if (!key) return;
  const config = storageConfig();
  if (!config?.bucketIssues) return;
  await deleteObjectSafely(config.bucketIssues, key);
}

export async function resolveAttachmentUrl(
  key: string | null | undefined,
): Promise<string | null> {
  if (!key) return null;
  const config = storageConfig();
  if (!config?.bucketIssues) return null;
  return presignGetUrl(config.bucketIssues, key);
}
