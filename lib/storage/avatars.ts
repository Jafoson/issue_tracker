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
 * Prüft Mime-Type/Größe und stellt eine presigned PUT-URL aus. RBAC
 * (eigene Session vs. `workspace.update`) bleibt bewusst außerhalb dieser
 * Datei — sie kennt nur den Storage, nicht die Berechtigungsmodelle der
 * aufrufenden Features (analog zu `lib/mail`, das auch nichts von
 * Workspace-Rollen weiß).
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
 * Bestätigt einen Upload nach dem direkten PUT gegen S3: prüft, dass der
 * Key wirklich diesem Owner gehört (gegen manipulierte Keys aus dem
 * Client) und dass das Objekt tatsächlich existiert und die Größe einhält.
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
