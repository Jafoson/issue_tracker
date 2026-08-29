import "server-only";

// ─── S3 configuration ────────────────────────────────────────────────────
//
// Controlled exclusively through the environment, analogous to
// `lib/mail/config.ts`. Without `S3_ENDPOINT` (or missing keys/bucket),
// avatar upload stays off; the app keeps running with plain initials
// avatars, same as before this file existed.

export interface StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketAvatars: string;
  /// `null` means: no `S3_BUCKET_ISSUES` set — issue attachments then stay
  /// off, regardless of whether avatars are configured. Unlike
  /// `bucketAvatars`, not a precondition for `storageConfig()` to return
  /// anything at all: a pure avatar setup should keep running unchanged,
  /// without knowing about the `issues` bucket.
  bucketIssues: string | null;
}

/**
 * Reads the S3 configuration from the environment — freshly on every call,
 * not cached: tests set `process.env` deliberately for one case and expect
 * the next check to see it too (see `lib/mail/config.ts`).
 */
export function storageConfig(): StorageConfig | null {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const bucketAvatars = process.env.S3_BUCKET_AVATARS;
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucketAvatars) {
    return null;
  }

  return {
    endpoint,
    region: process.env.S3_REGION || "us-east-1",
    accessKeyId,
    secretAccessKey,
    bucketAvatars,
    bucketIssues: process.env.S3_BUCKET_ISSUES || null,
  };
}

export function isStorageConfigured(): boolean {
  return storageConfig() !== null;
}

/** Dedicated switch for issue attachments — additionally needs `S3_BUCKET_ISSUES`. */
export function isAttachmentsConfigured(): boolean {
  const config = storageConfig();
  return config !== null && config.bucketIssues !== null;
}
