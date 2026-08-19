// Pur, ohne `server-only` — wird auch von der Client-Komponente
// `AvatarUploader` direkt importiert (nicht über den server-only Barrel),
// analog zu `lib/richtext`.

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export const AVATAR_MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function avatarExtensionFor(contentType: string): string | null {
  return AVATAR_MIME_EXTENSIONS[contentType] ?? null;
}
