import { escapeHtml } from "@/lib/mail/templates/html";
import { renderLayout } from "@/lib/mail/templates/layout";
import {
  resolveText,
  type TemplateOverride,
} from "@/lib/mail/templates/override";
import type { MailContent } from "@/lib/mail/templates/types";

export interface WelcomeEmailInput {
  to: string;
  firstName: string;
  /** Wohin der Knopf führt — üblicherweise die Login-Seite. */
  loginUrl: string;
}

/** Für `register()` — die direkte Registrierung mit Passwort, nicht die
 *  Einladung (die hat mit `invitationEmail` ihre eigene Vorlage). */
export function welcomeEmail(
  input: WelcomeEmailInput,
  override?: TemplateOverride,
): MailContent {
  const placeholders = { firstName: input.firstName };

  const subject = resolveText(
    "Willkommen beim Issue Tracker",
    override?.subject,
    placeholders,
  );
  const heading = resolveText(
    `Willkommen, ${input.firstName}`,
    override?.heading,
    placeholders,
  );
  const introText = resolveText(
    "dein Konto ist eingerichtet — du kannst dich ab sofort anmelden.",
    override?.bodyText,
    placeholders,
  );

  const bodyHtml = `<p style="margin: 0;">${escapeHtml(introText)}</p>`;

  const html = renderLayout({
    preheader: introText,
    heading: escapeHtml(heading),
    bodyHtml,
    ctaLabel: "Jetzt anmelden",
    ctaUrl: input.loginUrl,
    recipientEmail: input.to,
  });

  const text = `${heading}\n\n${introText}\n\nJetzt anmelden: ${input.loginUrl}`;

  return { subject, html, text };
}
