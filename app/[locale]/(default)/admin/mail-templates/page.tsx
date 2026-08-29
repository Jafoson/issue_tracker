import { MailTemplatesView } from "@/features/mail-templates/components/MailTemplatesView/MailTemplatesView";
import {
  getCurrentAdminEmail,
  getMailTemplates,
} from "@/features/mail-templates/queries";

export const dynamic = "force-dynamic";

/** Subject, heading, and intro text of each mail template — see `CLAUDE.md`
 *  (Email section) for the architecture. */
export default async function AdminMailTemplatesPage() {
  const [rows, defaultTestEmail] = await Promise.all([
    getMailTemplates(),
    getCurrentAdminEmail(),
  ]);
  return <MailTemplatesView rows={rows} defaultTestEmail={defaultTestEmail} />;
}
