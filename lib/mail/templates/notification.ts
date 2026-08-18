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
  /** Rollenname, Statuskey oder Kommentar-Vorschau — dieselbe Spalte wie in
   *  `Notification.text` (siehe `lib/notify`). */
  text: string;
  workspaceName: string;
  project: { name: string } | null;
  issue: { identifier: string; title: string } | null;
  /** Wohin der Knopf führt — absolute URL, vom Aufrufer gebaut (`lib/nav` +
   *  `lib/app-url`), damit diese Datei keine Routen kennen muss. */
  url: string;
  /** „Benachrichtigungen verwalten“-Link — die Einstellungsseite, auf der
   *  genau der `{type}Email`-Schalter dieser Mail sitzt. */
  manageUrl: string;
}

const HEADING: Record<NotificationEvent, string> = {
  assigned: "Dir wurde ein Issue zugewiesen",
  mentioned: "Du wurdest erwähnt",
  comment: "Neuer Kommentar",
  status: "Status geändert",
  invite: "Du bist jetzt Mitglied",
  role: "Deine Rolle wurde geändert",
  issueShared: "Ein Issue wurde mit dir geteilt",
};

const CTA_LABEL: Record<NotificationEvent, string> = {
  assigned: "Issue öffnen",
  mentioned: "Issue öffnen",
  comment: "Issue öffnen",
  status: "Issue öffnen",
  invite: "Mitglieder ansehen",
  role: "Mitglieder ansehen",
  issueShared: "Issue öffnen",
};

const SUBJECT: Record<
  NotificationEvent,
  (input: NotificationEmailInput) => string
> = {
  assigned: (i) =>
    i.issue ? `${i.issue.identifier} wurde dir zugewiesen` : HEADING.assigned,
  mentioned: (i) =>
    i.issue ? `Du wurdest in ${i.issue.identifier} erwähnt` : HEADING.mentioned,
  comment: (i) =>
    i.issue ? `Neuer Kommentar zu ${i.issue.identifier}` : HEADING.comment,
  status: (i) =>
    i.issue ? `Status geändert: ${i.issue.identifier}` : HEADING.status,
  invite: (i) =>
    `Du bist jetzt Mitglied von ${i.project?.name ?? i.workspaceName}`,
  role: () => HEADING.role,
  issueShared: (i) =>
    i.issue
      ? `${i.issue.identifier} wurde mit dir geteilt`
      : HEADING.issueShared,
};

/** Die Einleitung unter der Überschrift, im Klartext (Default-Pfad). */
function defaultIntro(input: NotificationEmailInput): string {
  const issueLabel = input.issue ? input.issue.identifier : "";
  const target = input.project
    ? `${input.project.name} (${input.workspaceName})`
    : input.workspaceName;

  switch (input.type) {
    case "assigned":
      return `${input.actorLabel} hat dir gerade ${issueLabel} zugewiesen.`;
    case "mentioned":
      return `${input.actorLabel} hat dich in ${issueLabel} erwähnt.`;
    case "comment":
      return `${input.actorLabel} hat ${issueLabel} kommentiert.`;
    case "status":
      return `${input.actorLabel} hat den Status von ${issueLabel} auf ${humanizeKey(input.text)} geändert.`;
    case "invite":
      return `${input.actorLabel} hat dich als ${input.text} zu ${target} hinzugefügt.`;
    case "role":
      return `${input.actorLabel} hat deine Rolle in ${target} auf ${input.text} geändert.`;
    case "issueShared":
      return `${input.actorLabel} hat ${issueLabel} mit dir geteilt.`;
  }
}

/** Kommentar-/Erwähnungsvorschau bzw. persönliche Nachricht als Zitat — nur
 *  bei den Anlässen, bei denen `text` tatsächlich ein Textausschnitt ist,
 *  nicht ein Status- oder Rollenname. */
function quoteFor(input: NotificationEmailInput): string | null {
  if (
    input.type !== "comment" &&
    input.type !== "mentioned" &&
    input.type !== "issueShared"
  )
    return null;
  if (!input.text) return null;
  return input.text;
}

/**
 * `override` kommt aus `MailTemplate` (Schlüssel `notification.{type}`, siehe
 * `features/mail-templates`) — ersetzt Betreff/Überschrift/Einleitung, die
 * Issue-Karte und das Zitat bleiben davon unberührt.
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
    ? `<p style="margin: 12px 0 0; padding-left: 12px; border-left: 3px solid #e4e4e4; color: #6b6b6b; font-style: italic;">„${escapeHtml(quote)}“</p>`
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
      ? [`${input.issue.identifier} „${input.issue.title}“`]
      : []),
    ...(quote ? [`„${quote}“`] : []),
    "",
    `${CTA_LABEL[input.type]}: ${input.url}`,
  ].join("\n");

  return { subject, html, text };
}
