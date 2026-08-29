import "server-only";
import { mailConfig } from "@/lib/mail/config";
import type { MailContent } from "@/lib/mail/templates/types";
import { getTransport } from "@/lib/mail/transport";

// ─── Mail sending: the one place that actually talks to SMTP ────────────────
//
// Same pattern as `lib/notify` and `lib/audit`: a narrow function that every
// caller sends through, without knowing anything itself about transport or
// configuration. Errors are swallowed and only logged — a stumbling email
// must never block an invitation, a role change, or a status update.
// Whoever needs to know whether sending even happened checks beforehand
// with `isMailConfigured()`.

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
