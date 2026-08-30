import { escapeHtml } from "@/lib/mail/templates/html";
import { renderLayout } from "@/lib/mail/templates/layout";
import {
  resolveText,
  type TemplateOverride,
} from "@/lib/mail/templates/override";
import type { MailContent } from "@/lib/mail/templates/types";

export interface MemberRemovedEmailInput {
  to: string;
  workspaceName: string;
  /** Set = removed only from this project, workspace access remains. */
  projectName?: string | null;
  actorName: string;
}

/** For `removeMember`/`removeProjectMember` — the only feedback to the
 *  removed person: the in-app path is out, the workspace layout already
 *  blocks them before the inbox loads (`canEnterWorkspace`).
 *
 *  `override` comes from `MailTemplate` (admin editing, see
 *  `features/mail-templates`) — replaces subject/heading/intro. */
export function memberRemovedEmail(
  input: MemberRemovedEmailInput,
  override?: TemplateOverride,
): MailContent {
  const target = input.projectName
    ? `${input.projectName} (${input.workspaceName})`
    : input.workspaceName;

  const placeholders = {
    actorName: input.actorName,
    workspaceName: input.workspaceName,
    projectName: input.projectName ?? "",
    target,
  };

  const subject = resolveText(
    `You were removed from ${target}`,
    override?.subject,
    placeholders,
  );
  const heading = resolveText(
    `You're no longer part of ${target}`,
    override?.heading,
    placeholders,
  );
  const introText = resolveText(
    input.projectName
      ? `${input.actorName} removed you from the project ${input.projectName}. You keep access to the workspace ${input.workspaceName}.`
      : `${input.actorName} removed you from the workspace ${input.workspaceName}. You no longer have access there.`,
    override?.bodyText,
    placeholders,
  );

  const bodyHtml = `<p style="margin: 0;">${escapeHtml(introText)}</p>`;

  const html = renderLayout({
    preheader: introText,
    heading: escapeHtml(heading),
    bodyHtml,
    recipientEmail: input.to,
  });

  const text = [heading, "", introText].join("\n");

  return { subject, html, text };
}
