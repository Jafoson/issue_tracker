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
  /** Where the button leads — usually the login page. */
  loginUrl: string;
}

/** For `register()` — direct registration with a password, not an
 *  invitation (that has its own template with `invitationEmail`). */
export function welcomeEmail(
  input: WelcomeEmailInput,
  override?: TemplateOverride,
): MailContent {
  const placeholders = { firstName: input.firstName };

  const subject = resolveText(
    "Welcome to Barynt",
    override?.subject,
    placeholders,
  );
  const heading = resolveText(
    `Welcome, ${input.firstName}`,
    override?.heading,
    placeholders,
  );
  const introText = resolveText(
    "your account is set up — you can sign in right away.",
    override?.bodyText,
    placeholders,
  );

  const bodyHtml = `<p style="margin: 0;">${escapeHtml(introText)}</p>`;

  const html = renderLayout({
    preheader: introText,
    heading: escapeHtml(heading),
    bodyHtml,
    ctaLabel: "Sign in now",
    ctaUrl: input.loginUrl,
    recipientEmail: input.to,
  });

  const text = `${heading}\n\n${introText}\n\nSign in now: ${input.loginUrl}`;

  return { subject, html, text };
}
