import { PlatformAudit } from "@/features/admin/components/PlatformAudit/PlatformAudit";
import { getAuditEntries } from "@/features/admin/queries";

export const dynamic = "force-dynamic";

/**
 * Das Protokoll der Plattform. Lädt seitenweise nach (Infinite Scroll,
 * `AuditLog`/`loadMorePlatformActivity`) statt einer festen Obergrenze — wer
 * weit zurück muss, scrollt einfach weiter.
 */
export default async function AdminAuditPage() {
  const { entries, nextCursor } = await getAuditEntries();
  return <PlatformAudit entries={entries} nextCursor={nextCursor} />;
}
