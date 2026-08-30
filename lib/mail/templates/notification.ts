import type { NotificationEvent } from "@/features/account/types";
import { escapeHtml, humanizeKey } from "@/lib/mail/templates/html";
import { renderLayout } from "@/lib/mail/templates/layout";
import {
  resolveText,
  type TemplateOverride,
} from "@/lib/mail/templates/override";
import type { MailContent } from "@/lib/mail/templates/types";

export interface NotificationEmailInput {
  to: string;
  type: NotificationEvent;
  actorLabel: string;
  /** Role name, status key, or comment preview — the same column as
   *  `Notification.text` (see `lib/notify`). */
  text: string;
  workspaceName: string;
  project: { name: string } | null;
  issue: { identifier: string; title: string } | null;
  /** Where the button leads — absolute URL, built by the caller (`lib/nav`
   *  + `lib/app-url`), so this file doesn't need to know about routes. */
  url: string;
  /** "Manage notifications" link — the settings page where exactly this
   *  email's `{type}Email` toggle lives. */
  manageUrl: string;
}

const HEADING: Record<NotificationEvent, string> = {
  assigned: "You were assigned an issue",
  mentioned: "You were mentioned",
  comment: "New comment",
  commentReply: "Reply to your comment",
  status: "Status changed",
  invite: "You're now a member",
  role: "Your role was changed",
  issueShared: "An issue was shared with you",
};

const CTA_LABEL: Record<NotificationEvent, string> = {
  assigned: "Open issue",
  mentioned: "Open issue",
  comment: "Open issue",
  commentReply: "Open issue",
  status: "Open issue",
  invite: "View members",
  role: "View members",
  issueShared: "Open issue",
};

const SUBJECT: Record<
  NotificationEvent,
  (input: NotificationEmailInput) => string
> = {
  assigned: (i) =>
    i.issue ? `${i.issue.identifier} was assigned to you` : HEADING.assigned,
  mentioned: (i) =>
    i.issue ? `You were mentioned in ${i.issue.identifier}` : HEADING.mentioned,
  comment: (i) =>
    i.issue ? `New comment on ${i.issue.identifier}` : HEADING.comment,
  commentReply: (i) =>
    i.issue
      ? `Reply to your comment in ${i.issue.identifier}`
      : HEADING.commentReply,
  status: (i) =>
    i.issue ? `Status changed: ${i.issue.identifier}` : HEADING.status,
  invite: (i) => `You're now a member of ${i.project?.name ?? i.workspaceName}`,
  role: () => HEADING.role,
  issueShared: (i) =>
    i.issue ? `${i.issue.identifier} was shared with you` : HEADING.issueShared,
};

/** The intro under the heading, in plain text (default path). */
function defaultIntro(input: NotificationEmailInput): string {
  const issueLabel = input.issue ? input.issue.identifier : "";
  const target = input.project
    ? `${input.project.name} (${input.workspaceName})`
    : input.workspaceName;

  switch (input.type) {
    case "assigned":
      return `${input.actorLabel} just assigned ${issueLabel} to you.`;
    case "mentioned":
      return `${input.actorLabel} mentioned you in ${issueLabel}.`;
    case "comment":
      return `${input.actorLabel} commented on ${issueLabel}.`;
    case "commentReply":
      return `${input.actorLabel} replied to your comment in ${issueLabel}.`;
    case "status":
      return `${input.actorLabel} changed the status of ${issueLabel} to ${humanizeKey(input.text)}.`;
    case "invite":
      return `${input.actorLabel} added you to ${target} as ${input.text}.`;
    case "role":
      return `${input.actorLabel} changed your role in ${target} to ${input.text}.`;
    case "issueShared":
      return `${input.actorLabel} shared ${issueLabel} with you.`;
  }
}

/** Comment/mention preview or personal message as a quote — only for the
 *  events where `text` is actually an excerpt of text, not a status or role
 *  name. */
function quoteFor(input: NotificationEmailInput): string | null {
  if (
    input.type !== "comment" &&
    input.type !== "commentReply" &&
    input.type !== "mentioned" &&
    input.type !== "issueShared"
  )
    return null;
  if (!input.text) return null;
  return input.text;
}

/**
 * `override` comes from `MailTemplate` (key `notification.{type}`, see
 * `features/mail-templates`) — replaces subject/heading/intro, the issue
 * card and the quote stay unaffected by it.
 */
export function notificationEmail(
  input: NotificationEmailInput,
  override?: TemplateOverride,
): MailContent {
  const placeholders = {
    actorLabel: input.actorLabel,
    workspaceName: input.workspaceName,
    projectName: input.project?.name ?? "",
    issueIdentifier: input.issue?.identifier ?? "",
    issueTitle: input.issue?.title ?? "",
    text: input.text,
  };

  const subject = resolveText(
    SUBJECT[input.type](input),
    override?.subject,
    placeholders,
  );
  const heading = resolveText(
    HEADING[input.type],
    override?.heading,
    placeholders,
  );
  const introText = resolveText(
    defaultIntro(input),
    override?.bodyText,
    placeholders,
  );

  const issueCardHtml = input.issue
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #eef1e8; border-radius: 8px; margin: 12px 0 0;">
        <tr>
          <td style="padding: 12px 16px;">
            <div style="font-family: monospace; color: #6b6b6b; font-size: 12px;">${escapeHtml(input.issue.identifier)}${input.project ? ` · ${escapeHtml(input.project.name)}` : ""}</div>
            <div style="font-weight: 700; margin-top: 2px;">${escapeHtml(input.issue.title)}</div>
          </td>
        </tr>
      </table>`
    : "";

  const quote = quoteFor(input);
  const quoteHtml = quote
    ? `<p style="margin: 12px 0 0; padding-left: 12px; border-left: 3px solid #e4e4e4; color: #6b6b6b; font-style: italic;">"${escapeHtml(quote)}"</p>`
    : "";

  const bodyHtml = `<p style="margin: 0;">${escapeHtml(introText)}</p>${issueCardHtml}${quoteHtml}`;

  const html = renderLayout({
    preheader: introText,
    heading: escapeHtml(heading),
    bodyHtml,
    ctaLabel: CTA_LABEL[input.type],
    ctaUrl: input.url,
    manageUrl: input.manageUrl,
    recipientEmail: input.to,
  });

  const text = [
    heading,
    "",
    introText,
    ...(input.issue
      ? [`${input.issue.identifier} "${input.issue.title}"`]
      : []),
    ...(quote ? [`"${quote}"`] : []),
    "",
    `${CTA_LABEL[input.type]}: ${input.url}`,
  ].join("\n");

  return { subject, html, text };
}
