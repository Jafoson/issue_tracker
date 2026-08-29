import "server-only";
import { storageConfig } from "@/lib/storage/config";
import {
  type AvatarKind,
  avatarObjectKey,
  isOwnAvatarKey,
} from "@/lib/storage/keys";
import {
  deleteObjectSafely,
  objectExists,
  presignGetUrl,
  presignPutUrl,
} from "@/lib/storage/presign";
import { AVATAR_MAX_BYTES, avatarExtensionFor } from "@/lib/storage/validation";

export type { AvatarKind };

export type RequestAvatarUploadResult =
  | { ok: true; key: string; uploadUrl: string }
  | { error: string };

/**
 * Checks MIME type/size and issues a presigned PUT URL. RBAC (own session
 * vs. `workspace.update`) is deliberately kept outside this file — it only
 * knows about storage, not about the permission models of the calling
 * features (analogous to `lib/mail`, which also knows nothing about
 * workspace roles).
 */
export async function requestAvatarUpload(input: {
  kind: AvatarKind;
  ownerId: string;
  contentType: string;
  contentLength: number;
}): Promise<RequestAvatarUploadResult> {
  const config = storageConfig();
  if (!config) return { error: "Avatar uploads are not configured." };

  const ext = avatarExtensionFor(input.contentType);
  if (!ext) return { error: "Only PNG, JPEG, WebP or GIF are allowed." };
  if (input.contentLength > AVATAR_MAX_BYTES) {
    return { error: "File is too large (max. 5 MB)." };
  }

  const key = avatarObjectKey(input.kind, input.ownerId, ext);
  const uploadUrl = await presignPutUrl(config.bucketAvatars, key, {
    contentType: input.contentType,
  });
  if (!uploadUrl) return { error: "Avatar uploads are not configured." };

  return { ok: true, key, uploadUrl };
}

/**
 * Confirms an upload after the direct PUT against S3: checks that the key
 * really belongs to this owner (against tampered keys from the client) and
 * that the object actually exists and stays within the size limit.
 */
export async function finalizeAvatarUpload(
  kind: AvatarKind,
  ownerId: string,
  key: string,
): Promise<{ ok: true } | { error: string }> {
  if (!isOwnAvatarKey(kind, ownerId, key)) {
    return { error: "Invalid upload key." };
  }

  const config = storageConfig();
  if (!config) return { error: "Avatar uploads are not configured." };

  const head = await objectExists(config.bucketAvatars, key);
  if (!head.exists) return { error: "Upload not found — please try again." };
  if (head.size > AVATAR_MAX_BYTES) {
    await deleteObjectSafely(config.bucketAvatars, key);
    return { error: "File is too large (max. 5 MB)." };
  }

  return { ok: true };
}

export async function deleteAvatarObject(
  key: string | null | undefined,
): Promise<void> {
  if (!key) return;
  const config = storageConfig();
  if (!config) return;
  await deleteObjectSafely(config.bucketAvatars, key);
}

export async function resolveAvatarUrl(
  key: string | null | undefined,
): Promise<string | null> {
  if (!key) return null;
  const config = storageConfig();
  if (!config) return null;
  return presignGetUrl(config.bucketAvatars, key);
}
