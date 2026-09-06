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
    "Confirm your email address",
    override?.subject,
    placeholders,
  );
  const heading = resolveText(
    "Please confirm your email address",
    override?.heading,
    placeholders,
  );
  const introText = resolveText(
    "Welcome to Barynt. Confirm your address so we can activate your account and send you notifications about your issues.",
    override?.bodyText,
    placeholders,
  );

  const codeHtml = input.code
    ? `
    <p style="margin: 16px 0 8px; color: #6b6b6b;">Or enter this code in the app:</p>
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
    ? `The link${input.code ? " and code are" : " is"} valid for ${input.expiresInHours} hours. After that, you can simply request a new confirmation in the app.`
    : "This address was added without your doing? Ignore this email — the account will then stay unconfirmed.";

  const html = renderLayout({
    preheader: introText,
    heading: escapeHtml(heading),
    bodyHtml,
    ctaLabel: "Confirm email",
    ctaUrl: input.verifyUrl,
    footnoteHtml,
    recipientEmail: input.to,
  });

  const text = [
    heading,
    "",
    introText,
    "",
    `Confirm email: ${input.verifyUrl}`,
    ...(input.code ? [`Code: ${input.code}`] : []),
    "",
    input.expiresInHours
      ? `Valid for ${input.expiresInHours} hours.`
      : "If this wasn't you, you can ignore this email.",
  ].join("\n");

  return { subject, html, text };
}
