import { escapeHtml } from "@/lib/mail/templates/html";
import { renderLayout } from "@/lib/mail/templates/layout";
import {
  resolveText,
  type TemplateOverride,
} from "@/lib/mail/templates/override";
import type { MailContent } from "@/lib/mail/templates/types";

export interface EmailVerificationInput {
  to: string;
  firstName: string;
  /** The verification URL, token included — the caller builds it, this
   *  file knows nothing about the token format. */
  verifyUrl: string;
  /** Alternative to clicking the button — only set if the caller actually
   *  offers code matching (the app doesn't do that today, the field is
   *  prepared for a later extension). */
  code?: string;
  /** For the hint text under the button — without it, the text stays
   *  unspecific, rather than claiming a deadline that doesn't exist (yet). */
  expiresInHours?: number;
}

/**
 * For confirming an email address — no dedicated send point yet, see
 * `AccountProfileView.emailVerified` in `features/account/types.ts`. The
 * token itself (issuing, deadline, redeeming) doesn't exist yet; this
 * template only accepts the finished URL, analogous to `invitationEmail`.
 */
export function emailVerificationEmail(
  input: EmailVerificationInput,
  override?: TemplateOverride,
): MailContent {
  const placeholders = { firstName: input.firstName };

  const subject = resolveText(
    "Bestätige deine E-Mail-Adresse",
    override?.subject,
    placeholders,
  );
  const heading = resolveText(
    "Bitte bestätige deine E-Mail-Adresse",
    override?.heading,
    placeholders,
  );
  const introText = resolveText(
    "Willkommen bei Orbit. Bestätige deine Adresse, damit wir dein Konto aktivieren und dir Benachrichtigungen zu deinen Issues senden können.",
    override?.bodyText,
    placeholders,
  );

  const codeHtml = input.code
    ? `
    <p style="margin: 16px 0 8px; color: #6b6b6b;">Oder gib diesen Code in der App ein:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #eef1e8; border-radius: 8px;">
      <tr>
        <td style="padding: 16px; text-align: center; font-family: monospace; font-size: 22px; font-weight: 700; letter-spacing: 0.3em;">
          ${escapeHtml(input.code)}
        </td>
      </tr>
    </table>`
    : "";

  const bodyHtml = `
    <p style="margin: 0;">${escapeHtml(introText)}</p>
    ${codeHtml}`;

  const footnoteHtml = input.expiresInHours
    ? `Der Link${input.code ? " und der Code sind" : " ist"} ${input.expiresInHours} Stunden gültig. Danach kannst du in der App einfach eine neue Bestätigung anfordern.`
    : "Diese Adresse wurde ohne dein Zutun eingetragen? Ignorier die Mail — das Konto bleibt dann unbestätigt.";

  const html = renderLayout({
    preheader: introText,
    heading: escapeHtml(heading),
    bodyHtml,
    ctaLabel: "E-Mail bestätigen",
    ctaUrl: input.verifyUrl,
    footnoteHtml,
    recipientEmail: input.to,
  });

  const text = [
    heading,
    "",
    introText,
    "",
    `E-Mail bestätigen: ${input.verifyUrl}`,
    ...(input.code ? [`Code: ${input.code}`] : []),
    "",
    input.expiresInHours
      ? `Gültig für ${input.expiresInHours} Stunden.`
      : "Wenn du das nicht warst, kannst du diese Mail ignorieren.",
  ].join("\n");

  return { subject, html, text };
}
