import { escapeHtml } from "@/lib/mail/templates/html";
import { renderLayout } from "@/lib/mail/templates/layout";
import {
  resolveText,
  type TemplateOverride,
} from "@/lib/mail/templates/override";
import type { MailContent } from "@/lib/mail/templates/types";

export interface IssueShareEmailInput {
  to: string;
  actorName: string;
  issueIdentifier: string;
  issueTitle: string;
  /** Personal message from the person sharing — optional. */
  text?: string;
  /** The public read-only link (`/share/[token]`), no login required. */
  url: string;
}

/**
 * For `shareIssueByEmail` — unlike `notificationEmail`, this email goes to
 * an arbitrary address, not to an account in the system. The link is
 * therefore the public `/share/[token]` path, not the internal issue page,
 * and there's no "manage notifications" footer — the recipient has no
 * settings at all that could control that.
 */
export function issueShareEmail(
  input: IssueShareEmailInput,
  override?: TemplateOverride,
): MailContent {
  const placeholders = {
    actorLabel: input.actorName,
    issueIdentifier: input.issueIdentifier,
    issueTitle: input.issueTitle,
    text: input.text ?? "",
  };

  const subject = resolveText(
    `${input.actorName} shared "${input.issueTitle}" with you`,
    override?.subject,
    placeholders,
  );
  const heading = resolveText(
    "An issue was shared with you",
    override?.heading,
    placeholders,
  );
  const introText = resolveText(
    `${input.actorName} sent you the public link to ${input.issueIdentifier}.`,
    override?.bodyText,
    placeholders,
  );

  const issueCardHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #eef1e8; border-radius: 8px; margin: 12px 0 0;">
      <tr>
        <td style="padding: 12px 16px;">
          <div style="font-family: monospace; color: #6b6b6b; font-size: 12px;">${escapeHtml(input.issueIdentifier)}</div>
          <div style="font-weight: 700; margin-top: 2px;">${escapeHtml(input.issueTitle)}</div>
        </td>
      </tr>
    </table>`;

  const quoteHtml = input.text
    ? `<p style="margin: 12px 0 0; padding-left: 12px; border-left: 3px solid #e4e4e4; color: #6b6b6b; font-style: italic;">"${escapeHtml(input.text)}"</p>`
    : "";

  const bodyHtml = `<p style="margin: 0;">${escapeHtml(introText)}</p>${issueCardHtml}${quoteHtml}`;

  const html = renderLayout({
    preheader: introText,
    heading: escapeHtml(heading),
    bodyHtml,
    ctaLabel: "View issue",
    ctaUrl: input.url,
    recipientEmail: input.to,
  });

  const text = [
    heading,
    "",
    introText,
    `${input.issueIdentifier} "${input.issueTitle}"`,
    ...(input.text ? [`"${input.text}"`] : []),
    "",
    `View issue: ${input.url}`,
  ].join("\n");

  return { subject, html, text };
}
