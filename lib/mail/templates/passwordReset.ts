import { escapeHtml, formatDate } from "@/lib/mail/templates/html";
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
  /** From the `User-Agent`, e.g. "Chrome on macOS" — optional: the app
   *  doesn't evaluate this anywhere today, the field exists for a later
   *  extension. */
  device?: string;
  /** From IP geolocation, e.g. "Hamburg, DE" — the same caveat as
   *  `device`. */
  location?: string;
  expiresInMinutes: number;
  resetUrl: string;
  /** Link to the security settings, for the alert box — optional, because
   *  the question "which workspace" isn't answered in this file. */
  securityUrl?: string;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * For the forgot-password path — there's no reset token yet (issuing,
 * deadline, redeeming), this template only accepts the finished URL,
 * analogous to `invitationEmail`/`emailVerificationEmail`.
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
    "Reset your password",
    override?.subject,
    placeholders,
  );
  const heading = resolveText(
    "Reset your password",
    override?.heading,
    placeholders,
  );
  const introText = resolveText(
    `A password reset was requested for your account ${input.to}. Choose a new password — existing sessions will then be signed out.`,
    override?.bodyText,
    placeholders,
  );

  const rows = [
    {
      label: "Requested",
      value: `${formatDate(input.requestedAt)}, ${formatTime(input.requestedAt)}`,
    },
    ...(input.device
      ? [{ label: "Device", value: escapeHtml(input.device) }]
      : []),
    ...(input.location
      ? [{ label: "Location", value: escapeHtml(input.location) }]
      : []),
    {
      label: "Valid until",
      value: `${formatTime(expiresAt)} (${input.expiresInMinutes} min)`,
    },
  ];

  const alertHtml = renderAlertBox(
    "Wasn't you?",
    `Change your password as a precaution.${
      input.securityUrl
        ? ` <a href="${escapeHtml(input.securityUrl)}" style="color: inherit;">Open security settings</a>.`
        : ""
    }`,
  );

  const bodyHtml = `
    <p style="margin: 0;">${escapeHtml(introText)}</p>
    ${renderDetailTable(rows)}`;

  const html = renderLayout({
    preheader: `Password reset requested for ${input.to}.`,
    heading: escapeHtml(heading),
    bodyHtml: `${bodyHtml}${alertHtml}`,
    ctaLabel: "Choose new password",
    ctaUrl: input.resetUrl,
    recipientEmail: input.to,
  });

  const text = [
    heading,
    "",
    introText,
    "",
    `Requested: ${formatDate(input.requestedAt)}, ${formatTime(input.requestedAt)}`,
    ...(input.device ? [`Device: ${input.device}`] : []),
    ...(input.location ? [`Location: ${input.location}`] : []),
    `Valid until ${formatTime(expiresAt)} (${input.expiresInMinutes} min)`,
    "",
    `Choose new password: ${input.resetUrl}`,
    "",
    "Wasn't you? Change your password as a precaution.",
  ].join("\n");

  return { subject, html, text };
}
