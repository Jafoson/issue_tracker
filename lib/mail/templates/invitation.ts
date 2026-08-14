import { escapeHtml, formatDateDe } from "@/lib/mail/templates/html";
import { renderDetailTable, renderLayout } from "@/lib/mail/templates/layout";
import {
  resolveText,
  type TemplateOverride,
} from "@/lib/mail/templates/override";
import type { MailContent } from "@/lib/mail/templates/types";

export interface InvitationEmailInput {
  to: string;
  workspaceName: string;
  /** Gesetzt = Einladung in ein bestimmtes Projekt. */
  projectName?: string | null;
  roleName: string;
  inviterName: string;
  expiresAt: Date;
  inviteUrl: string;
}

/** Für die unbekannte Adresse aus `inviteWorkspaceMember`/`inviteProjectMember`
 *  — das neue Konto hat kein Passwort, ohne diesen Link käme niemand hinein.
 *
 *  `override` kommt aus `MailTemplate` (Admin-Bearbeitung, siehe
 *  `features/mail-templates`) — ersetzt Betreff/Überschrift/Einleitung,
 *  Detailtabelle und Fußzeile bleiben davon unberührt. */
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
    `Einladung zu ${target}`,
    override?.subject,
    placeholders,
  );
  const heading = resolveText(
    `${input.inviterName} hat dich zu ${target} eingeladen`,
    override?.heading,
    placeholders,
  );
  const introText = resolveText(
    `${input.inviterName} hat dich eingeladen — hier die Details:`,
    override?.bodyText,
    placeholders,
  );

  const rows = [
    { label: "Workspace", value: escapeHtml(input.workspaceName) },
    ...(input.projectName
      ? [{ label: "Projekt", value: escapeHtml(input.projectName) }]
      : []),
    { label: "Rolle", value: escapeHtml(input.roleName) },
    { label: "Eingeladen von", value: escapeHtml(input.inviterName) },
  ];

  const bodyHtml = `<p style="margin: 0 0 12px;">${escapeHtml(introText)}</p>${renderDetailTable(rows)}`;

  const html = renderLayout({
    preheader: introText,
    heading: escapeHtml(heading),
    bodyHtml,
    ctaLabel: "Einladung annehmen",
    ctaUrl: input.inviteUrl,
    footnoteHtml: `Die Einladung ist bis zum ${formatDateDe(input.expiresAt)} gültig. Kennst du ${escapeHtml(input.inviterName)} nicht? Dann ignorier diese Mail — ohne Klick auf den Knopf passiert nichts.`,
    recipientEmail: input.to,
  });

  const text = [
    heading,
    "",
    introText,
    "",
    `Workspace: ${input.workspaceName}`,
    ...(input.projectName ? [`Projekt: ${input.projectName}`] : []),
    `Rolle: ${input.roleName}`,
    `Eingeladen von: ${input.inviterName}`,
    "",
    `Einladung annehmen: ${input.inviteUrl}`,
    `Gültig bis ${formatDateDe(input.expiresAt)}.`,
  ].join("\n");

  return { subject, html, text };
}
