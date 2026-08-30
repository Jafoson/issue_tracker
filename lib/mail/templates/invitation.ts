import { escapeHtml, formatDate } from "@/lib/mail/templates/html";
import { renderDetailTable, renderLayout } from "@/lib/mail/templates/layout";
import {
  resolveText,
  type TemplateOverride,
} from "@/lib/mail/templates/override";
import type { MailContent } from "@/lib/mail/templates/types";

export interface InvitationEmailInput {
  to: string;
  workspaceName: string;
  /** Set = invitation into a specific project. */
  projectName?: string | null;
  roleName: string;
  inviterName: string;
  expiresAt: Date;
  inviteUrl: string;
}

/** For the unknown address from `inviteWorkspaceMember`/`inviteProjectMember`
 *  — the new account has no password, without this link no one could get in.
 *
 *  `override` comes from `MailTemplate` (admin editing, see
 *  `features/mail-templates`) — replaces subject/heading/intro, the detail
 *  table and footer stay unaffected by it. */
export function invitationEmail(
  input: InvitationEmailInput,
  override?: TemplateOverride,
): MailContent {
  const target = input.projectName
    ? `${input.projectName} (${input.workspaceName})`
    : input.workspaceName;

  const placeholders = {
    inviterName: input.inviterName,
    workspaceName: input.workspaceName,
    projectName: input.projectName ?? "",
    roleName: input.roleName,
    target,
  };

  const subject = resolveText(
    `Invitation to ${target}`,
    override?.subject,
    placeholders,
  );
  const heading = resolveText(
    `${input.inviterName} invited you to ${target}`,
    override?.heading,
    placeholders,
  );
  const introText = resolveText(
    `${input.inviterName} invited you — here are the details:`,
    override?.bodyText,
    placeholders,
  );

  const rows = [
    { label: "Workspace", value: escapeHtml(input.workspaceName) },
    ...(input.projectName
      ? [{ label: "Project", value: escapeHtml(input.projectName) }]
      : []),
    { label: "Role", value: escapeHtml(input.roleName) },
    { label: "Invited by", value: escapeHtml(input.inviterName) },
  ];

  const bodyHtml = `<p style="margin: 0 0 12px;">${escapeHtml(introText)}</p>${renderDetailTable(rows)}`;

  const html = renderLayout({
    preheader: introText,
    heading: escapeHtml(heading),
    bodyHtml,
    ctaLabel: "Accept invitation",
    ctaUrl: input.inviteUrl,
    footnoteHtml: `This invitation is valid until ${formatDate(input.expiresAt)}. Don't know ${escapeHtml(input.inviterName)}? Then ignore this email — nothing happens unless you click the button.`,
    recipientEmail: input.to,
  });

  const text = [
    heading,
    "",
    introText,
    "",
    `Workspace: ${input.workspaceName}`,
    ...(input.projectName ? [`Project: ${input.projectName}`] : []),
    `Role: ${input.roleName}`,
    `Invited by: ${input.inviterName}`,
    "",
    `Accept invitation: ${input.inviteUrl}`,
    `Valid until ${formatDate(input.expiresAt)}.`,
  ].join("\n");

  return { subject, html, text };
}
