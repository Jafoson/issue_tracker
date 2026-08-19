import "server-only";
import { getClient } from "@/lib/storage/client";
import { storageConfig } from "@/lib/storage/config";

// Kurz: der Upload beginnt sofort nach der Anfrage, keine Notwendigkeit für
// eine lange Lebensdauer.
const PUT_EXPIRES_IN = 120;
// Eine Server-Render-Ladung lang gültig — großzügig, da neu signiert wird,
// sobald die Seite das nächste Mal rendert (kein URL-Cache, siehe avatars.ts).
const GET_EXPIRES_IN = 3600;

/** `/` in einem Objekt-Key bleibt Pfadtrenner, alles andere wird kodiert. */
function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

/** Immer Path-Style (`<endpoint>/<bucket>/<key>`) — funktioniert für rustfs,
 *  MinIO und AWS S3 gleichermaßen, ohne bucket-spezifische Subdomain. */
function objectUrl(endpoint: string, bucket: string, key: string): string {
  return `${endpoint.replace(/\/$/, "")}/${bucket}/${encodeKey(key)}`;
}

export async function presignPutUrl(
  bucket: string,
  key: string,
  opts: { contentType: string },
): Promise<string | null> {
  const config = storageConfig();
  const client = getClient();
  if (!config || !client) return null;

  const url = new URL(objectUrl(config.endpoint, bucket, key));
  url.searchParams.set("X-Amz-Expires", String(PUT_EXPIRES_IN));

  const request = await client.sign(url.toString(), {
    method: "PUT",
    headers: { "content-type": opts.contentType },
    aws: { signQuery: true },
  });
  return request.url;
}

export async function presignGetUrl(
  bucket: string,
  key: string,
): Promise<string | null> {
  const config = storageConfig();
  const client = getClient();
  if (!config || !client) return null;

  const url = new URL(objectUrl(config.endpoint, bucket, key));
  url.searchParams.set("X-Amz-Expires", String(GET_EXPIRES_IN));

  const request = await client.sign(url.toString(), {
    method: "GET",
    aws: { signQuery: true },
  });
  return request.url;
}

export async function objectExists(
  bucket: string,
  key: string,
): Promise<{ exists: true; size: number } | { exists: false }> {
  const config = storageConfig();
  const client = getClient();
  if (!config || !client) return { exists: false };

  try {
    const res = await client.fetch(objectUrl(config.endpoint, bucket, key), {
      method: "HEAD",
    });
    if (!res.ok) return { exists: false };
    return {
      exists: true,
      size: Number(res.headers.get("content-length") ?? 0),
    };
  } catch {
    return { exists: false };
  }
}

/** Löscht ein Objekt best-effort — wirft nie, analog zu `sendMail()`. */
export async function deleteObjectSafely(
  bucket: string,
  key: string,
): Promise<void> {
  const config = storageConfig();
  const client = getClient();
  if (!config || !client) return;

  try {
    await client.fetch(objectUrl(config.endpoint, bucket, key), {
      method: "DELETE",
    });
  } catch (error) {
    console.error(
      "[lib/storage] failed to delete object",
      { bucket, key },
      error,
    );
  }
}
