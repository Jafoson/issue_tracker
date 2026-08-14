import { MailTemplatesView } from "@/features/mail-templates/components/MailTemplatesView/MailTemplatesView";
import {
  getCurrentAdminEmail,
  getMailTemplates,
} from "@/features/mail-templates/queries";

export const dynamic = "force-dynamic";

/** Betreff, Überschrift und Einleitungstext jeder Mail-Vorlage — siehe
 *  `CLAUDE.md` (Abschnitt E-Mail) für die Architektur. */
export default async function AdminMailTemplatesPage() {
  const [rows, defaultTestEmail] = await Promise.all([
    getMailTemplates(),
    getCurrentAdminEmail(),
  ]);
  return <MailTemplatesView rows={rows} defaultTestEmail={defaultTestEmail} />;
}
