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
  /** Gesetzt = nur aus diesem Projekt entfernt, Workspace-Zugriff bleibt. */
  projectName?: string | null;
  actorName: string;
}

/** Für `removeMember`/`removeProjectMember` — die einzige Rückmeldung an die
 *  entfernte Person: der In-App-Weg scheidet aus, das Workspace-Layout
 *  blockt sie schon vor der Inbox aus (`canEnterWorkspace`).
 *
 *  `override` kommt aus `MailTemplate` (Admin-Bearbeitung, siehe
 *  `features/mail-templates`) — ersetzt Betreff/Überschrift/Einleitung. */
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
    `Du wurdest aus ${target} entfernt`,
    override?.subject,
    placeholders,
  );
  const heading = resolveText(
    `Du bist nicht mehr Teil von ${target}`,
    override?.heading,
    placeholders,
  );
  const introText = resolveText(
    input.projectName
      ? `${input.actorName} hat dich aus dem Projekt ${input.projectName} entfernt. Der Workspace ${input.workspaceName} bleibt dir erhalten.`
      : `${input.actorName} hat dich aus dem Workspace ${input.workspaceName} entfernt. Du hast dort keinen Zugriff mehr.`,
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
