// Pure, no `server-only` — also imported directly by the client component
// `AvatarUploader` (not through the server-only barrel), analogous to
// `lib/richtext`.

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

/// Every file type is permitted (images, general files, videos) — only the
/// size is limited. Generous enough for short video clips; easy to adjust
/// in this one place.
export const ATTACHMENT_MAX_BYTES = 100 * 1024 * 1024; // 100 MB
