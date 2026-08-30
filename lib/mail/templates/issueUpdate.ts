import { escapeHtml } from "@/lib/mail/templates/html";
import { renderLayout } from "@/lib/mail/templates/layout";
import {
  resolveText,
  type TemplateOverride,
} from "@/lib/mail/templates/override";
import type { MailContent } from "@/lib/mail/templates/types";

export interface IssueUpdateChange {
  /** Display name of the changed field, e.g. "Priority", "Title", "Labels". */
  field: string;
  /** If missing, the change counts as newly set rather than changed (e.g. assignee from no one). */
  from?: string;
  to: string;
}

export interface IssueUpdateEmailInput {
  to: string;
  actorLabel: string;
  issue: { identifier: string; title: string };
  /** Multiple field changes from one edit in a single email, instead of one
   *  per field — whoever changes title, priority, and labels in one go
   *  should also only trigger one email. */
  changes: IssueUpdateChange[];
  url: string;
  manageUrl?: string;
}

/**
 * For changes that `notify()` doesn't cover today (title, priority, labels,
 * type — see `type NotificationEvent` in `features/account/types.ts`, which
 * only knows `assigned`/`mentioned`/`comment`/`status`/`invite`/`role`).
 * Still without a send point: for that, `notify()` would need a new event
 * plus an `*InApp`/`*Email` column pair in `UserPreferences`, plus the spot
 * in `features/issues/actions.ts` that compares the old against the new
 * values (like `notifyStatusChange` already does for status).
 */
export function issueUpdateEmail(
  input: IssueUpdateEmailInput,
  override?: TemplateOverride,
): MailContent {
  const placeholders = {
    actorLabel: input.actorLabel,
    issueIdentifier: input.issue.identifier,
    issueTitle: input.issue.title,
  };

  const subject = resolveText(
    `${input.issue.identifier} was updated`,
    override?.subject,
    placeholders,
  );
  const heading = resolveText(
    `${input.issue.identifier} was updated`,
    override?.heading,
    placeholders,
  );
  const introText = resolveText(
    `${input.actorLabel} changed ${input.issue.identifier} "${input.issue.title}":`,
    override?.bodyText,
    placeholders,
  );

  const changeRows = input.changes
    .map((c) => {
      const value = c.from
        ? `${escapeHtml(c.from)} → ${escapeHtml(c.to)}`
        : escapeHtml(c.to);
      return `
      <tr>
        <td style="padding: 4px 12px 4px 0; color: #6b6b6b; white-space: nowrap;">${escapeHtml(c.field)}</td>
        <td style="padding: 4px 0;">${value}</td>
      </tr>`;
    })
    .join("");

  const bodyHtml = `
    <p style="margin: 0 0 12px;">${escapeHtml(introText)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${changeRows}</table>`;

  const html = renderLayout({
    preheader: `${input.actorLabel} changed ${input.issue.identifier}.`,
    heading: escapeHtml(heading),
    bodyHtml,
    ctaLabel: "Open issue",
    ctaUrl: input.url,
    manageUrl: input.manageUrl,
    recipientEmail: input.to,
  });

  const changesText = input.changes
    .map((c) => `- ${c.field}: ${c.from ? `${c.from} → ${c.to}` : c.to}`)
    .join("\n");

  const text = `${heading}\n\n${introText}\n\n${changesText}\n\nOpen issue: ${input.url}`;

  return { subject, html, text };
}
