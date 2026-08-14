import "server-only";
import { mailConfig } from "@/lib/mail/config";
import type { MailContent } from "@/lib/mail/templates/types";
import { getTransport } from "@/lib/mail/transport";

// ─── Mailversand: die eine Stelle, die tatsächlich mit SMTP spricht ──────────
//
// Dasselbe Muster wie `lib/notify` und `lib/audit`: eine schmale Funktion, über
// die jeder Aufrufer verschickt, ohne selbst etwas von Transport oder
// Konfiguration zu wissen. Fehler werden geschluckt und nur geloggt — eine
// hakende Mail darf nie eine Einladung, eine Rollenänderung oder eine
// Statusaktualisierung verhindern. Wer wissen muss, ob überhaupt versendet
// wurde, prüft vorher selbst mit `isMailConfigured()`.

export interface MailMessage extends MailContent {
  to: string;
}

export async function sendMail(message: MailMessage): Promise<void> {
  const config = mailConfig();
  const transport = getTransport();
  if (!config || !transport) {
    console.warn(
      "[mail] SMTP_HOST ist nicht gesetzt — Mail wird nicht verschickt:",
      message.subject,
    );
    return;
  }

  try {
    await transport.sendMail({
      from: config.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  } catch (error) {
    console.error("[mail] Versand fehlgeschlagen:", message.subject, error);
  }
}

export { isMailConfigured } from "@/lib/mail/config";
