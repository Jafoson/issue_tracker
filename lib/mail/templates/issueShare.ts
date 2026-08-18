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
  /** Persönliche Nachricht der teilenden Person — optional. */
  text?: string;
  /** Der öffentliche Lese-Link (`/share/[token]`), kein Login nötig. */
  url: string;
}

/**
 * Für `shareIssueByEmail` — anders als `notificationEmail` geht diese Mail an
 * eine beliebige Adresse, nicht an ein Konto im System. Der Link ist deshalb
 * der öffentliche `/share/[token]`-Weg, nicht die interne Issue-Seite, und es
 * gibt keinen „Benachrichtigungen verwalten“-Fuß — die Empfängerin hat gar
 * keine Einstellungen, die das steuern könnten.
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
    `${input.actorName} hat dir „${input.issueTitle}“ geteilt`,
    override?.subject,
    placeholders,
  );
  const heading = resolveText(
    "Ein Issue wurde mit dir geteilt",
    override?.heading,
    placeholders,
  );
  const introText = resolveText(
    `${input.actorName} hat dir den öffentlichen Link zu ${input.issueIdentifier} geschickt.`,
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
    ? `<p style="margin: 12px 0 0; padding-left: 12px; border-left: 3px solid #e4e4e4; color: #6b6b6b; font-style: italic;">„${escapeHtml(input.text)}“</p>`
    : "";

  const bodyHtml = `<p style="margin: 0;">${escapeHtml(introText)}</p>${issueCardHtml}${quoteHtml}`;

  const html = renderLayout({
    preheader: introText,
    heading: escapeHtml(heading),
    bodyHtml,
    ctaLabel: "Issue ansehen",
    ctaUrl: input.url,
    recipientEmail: input.to,
  });

  const text = [
    heading,
    "",
    introText,
    `${input.issueIdentifier} „${input.issueTitle}“`,
    ...(input.text ? [`„${input.text}“`] : []),
    "",
    `Issue ansehen: ${input.url}`,
  ].join("\n");

  return { subject, html, text };
}
