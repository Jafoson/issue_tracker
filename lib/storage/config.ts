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
  /// `null` heißt: kein `S3_BUCKET_ISSUES` gesetzt — Issue-Anhänge bleiben
  /// dann aus, unabhängig davon, ob Avatare konfiguriert sind. Anders als
  /// `bucketAvatars` keine Voraussetzung dafür, dass `storageConfig()`
  /// überhaupt etwas zurückgibt: ein reines Avatar-Setup soll unverändert
  /// weiterlaufen, ohne den `issues`-Bucket zu kennen.
  bucketIssues: string | null;
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
    bucketIssues: process.env.S3_BUCKET_ISSUES || null,
  };
}

export function isStorageConfigured(): boolean {
  return storageConfig() !== null;
}

/** Eigener Schalter für Issue-Anhänge — braucht zusätzlich `S3_BUCKET_ISSUES`. */
export function isAttachmentsConfigured(): boolean {
  const config = storageConfig();
  return config !== null && config.bucketIssues !== null;
}
