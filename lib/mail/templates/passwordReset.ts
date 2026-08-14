import { escapeHtml, formatDateDe } from "@/lib/mail/templates/html";
import {
  renderAlertBox,
  renderDetailTable,
  renderLayout,
} from "@/lib/mail/templates/layout";
import {
  resolveText,
  type TemplateOverride,
} from "@/lib/mail/templates/override";
import type { MailContent } from "@/lib/mail/templates/types";

export interface PasswordResetEmailInput {
  to: string;
  requestedAt: Date;
  /** Aus dem `User-Agent`, z. B. "Chrome auf macOS" — optional: die App wertet
   *  das heute nirgends aus, das Feld ist für einen späteren Ausbau da. */
  device?: string;
  /** Aus einer IP-Geolokation, z. B. "Hamburg, DE" — dieselbe Einschränkung
   *  wie bei `device`. */
  location?: string;
  expiresInMinutes: number;
  resetUrl: string;
  /** Link zu den Sicherheitseinstellungen, für die Warnbox — optional, weil
   *  die Frage „welcher Workspace“ nicht in dieser Datei beantwortet wird. */
  securityUrl?: string;
}

function formatTimeDe(date: Date): string {
  return date.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Für den Passwort-vergessen-Weg — es gibt noch keinen Reset-Token (Ausstellung,
 * Frist, Einlösen), diese Vorlage nimmt nur die fertige URL entgegen, analog zu
 * `invitationEmail`/`emailVerificationEmail`.
 */
export function passwordResetEmail(
  input: PasswordResetEmailInput,
  override?: TemplateOverride,
): MailContent {
  const expiresAt = new Date(
    input.requestedAt.getTime() + input.expiresInMinutes * 60 * 1000,
  );

  const placeholders = { email: input.to };

  const subject = resolveText(
    "Passwort zurücksetzen",
    override?.subject,
    placeholders,
  );
  const heading = resolveText(
    "Passwort zurücksetzen",
    override?.heading,
    placeholders,
  );
  const introText = resolveText(
    `Für dein Konto ${input.to} wurde eine Passwort-Zurücksetzung angefordert. Wähle ein neues Passwort — bestehende Sitzungen werden danach abgemeldet.`,
    override?.bodyText,
    placeholders,
  );

  const rows = [
    {
      label: "Anfrage",
      value: `${formatDateDe(input.requestedAt)}, ${formatTimeDe(input.requestedAt)}`,
    },
    ...(input.device
      ? [{ label: "Gerät", value: escapeHtml(input.device) }]
      : []),
    ...(input.location
      ? [{ label: "Ort", value: escapeHtml(input.location) }]
      : []),
    {
      label: "Gültig bis",
      value: `${formatTimeDe(expiresAt)} (${input.expiresInMinutes} Min.)`,
    },
  ];

  const alertHtml = renderAlertBox(
    "Warst das nicht du?",
    `Ändere dein Passwort sicherheitshalber.${
      input.securityUrl
        ? ` <a href="${escapeHtml(input.securityUrl)}" style="color: inherit;">Sicherheitseinstellungen öffnen</a>.`
        : ""
    }`,
  );

  const bodyHtml = `
    <p style="margin: 0;">${escapeHtml(introText)}</p>
    ${renderDetailTable(rows)}`;

  const html = renderLayout({
    preheader: `Passwort-Zurücksetzung für ${input.to} angefordert.`,
    heading: escapeHtml(heading),
    bodyHtml: `${bodyHtml}${alertHtml}`,
    ctaLabel: "Neues Passwort wählen",
    ctaUrl: input.resetUrl,
    recipientEmail: input.to,
  });

  const text = [
    heading,
    "",
    introText,
    "",
    `Anfrage: ${formatDateDe(input.requestedAt)}, ${formatTimeDe(input.requestedAt)}`,
    ...(input.device ? [`Gerät: ${input.device}`] : []),
    ...(input.location ? [`Ort: ${input.location}`] : []),
    `Gültig bis ${formatTimeDe(expiresAt)} (${input.expiresInMinutes} Min.)`,
    "",
    `Neues Passwort wählen: ${input.resetUrl}`,
    "",
    "Warst das nicht du? Ändere dein Passwort sicherheitshalber.",
  ].join("\n");

  return { subject, html, text };
}
