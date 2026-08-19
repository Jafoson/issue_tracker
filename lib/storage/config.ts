import "server-only";

// ─── S3-Konfiguration ─────────────────────────────────────────────────────
//
// Ausschließlich über die Umgebung gesteuert, analog zu `lib/mail/config.ts`.
// Ohne `S3_ENDPOINT` (oder fehlende Keys/Bucket) bleibt Avatar-Upload aus;
// die App läuft mit reinen Initialen-Avataren weiter, wie schon vor dieser
// Datei.

export interface StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketAvatars: string;
}

/**
 * Liest die S3-Konfiguration aus der Umgebung — bei jedem Aufruf neu, nicht
 * gecacht: Tests setzen `process.env` gezielt für einen Fall und erwarten,
 * dass die nächste Prüfung das auch sieht (siehe `lib/mail/config.ts`).
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
  };
}

export function isStorageConfigured(): boolean {
  return storageConfig() !== null;
}
