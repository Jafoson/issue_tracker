import { PlatformAudit } from "@/features/admin/components/PlatformAudit/PlatformAudit";
import { getAuditEntries } from "@/features/admin/queries";

export const dynamic = "force-dynamic";

/**
 * Das Protokoll der Plattform.
 *
 * Die Obergrenze steht hier und nicht in der Komponente: die Ansicht zeigt, was
 * sie bekommt. Zweihundert Zeilen sind der Verlauf, den man tatsächlich
 * durchsieht — wer weiter zurück muss, fragt die Datenbank, und dafür ist das
 * Protokoll denormalisiert (`lib/audit.ts`).
 */
export default async function AdminAuditPage() {
  const entries = await getAuditEntries(200);
  return <PlatformAudit entries={entries} />;
}
