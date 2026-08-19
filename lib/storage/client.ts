import "server-only";
import { AwsClient } from "aws4fetch";
import { type StorageConfig, storageConfig } from "@/lib/storage/config";

// Der Client hält keine Verbindung offen (signiert nur Requests, die per
// `fetch` laufen), wird aber trotzdem wiederverwendet statt bei jedem Aufruf
// neu aufgebaut — analog zu `lib/mail/transport.ts`. Ändert sich die
// Konfiguration, wird ein neuer Client erzeugt.
//
// `aws4fetch` statt `@aws-sdk/client-s3`: Letzteres lässt sich unter
// Turbopack-Dev in diesem Projekt nicht laden (`next dev` bricht mit
// "Cannot find module '@aws-sdk/client-s3-<hash>'" — reproduziert auch in
// einer isolierten Route ohne jeden Bezug zu Avataren, verschwindet mit
// `next dev --webpack`). `aws4fetch` ist abhängigkeitsfrei, signiert über die
// Standard-`fetch`-API und hat kein Paket-Layout, an dem Turbopacks
// Externals-Auflösung scheitert.
let cached: { config: StorageConfig; client: AwsClient } | null = null;

export function getClient(): AwsClient | null {
  const config = storageConfig();
  if (!config) {
    cached = null;
    return null;
  }

  if (cached && sameConfig(cached.config, config)) return cached.client;

  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: config.region,
    service: "s3",
  });
  cached = { config, client };
  return client;
}

function sameConfig(a: StorageConfig, b: StorageConfig): boolean {
  return (
    a.endpoint === b.endpoint &&
    a.region === b.region &&
    a.accessKeyId === b.accessKeyId &&
    a.secretAccessKey === b.secretAccessKey &&
    a.bucketAvatars === b.bucketAvatars
  );
}
