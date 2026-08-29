import { PlatformAudit } from "@/features/admin/components/PlatformAudit/PlatformAudit";
import { getAuditEntries } from "@/features/admin/queries";

export const dynamic = "force-dynamic";

/**
 * The platform's audit log. Loads page by page (infinite scroll,
 * `AuditLog`/`loadMorePlatformActivity`) rather than a fixed upper limit —
 * anyone needing to go far back just keeps scrolling.
 */
export default async function AdminAuditPage() {
  const { entries, nextCursor } = await getAuditEntries();
  return <PlatformAudit entries={entries} nextCursor={nextCursor} />;
}
