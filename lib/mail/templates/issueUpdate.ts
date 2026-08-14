import { escapeHtml } from "@/lib/mail/templates/html";
import { renderLayout } from "@/lib/mail/templates/layout";
import {
  resolveText,
  type TemplateOverride,
} from "@/lib/mail/templates/override";
import type { MailContent } from "@/lib/mail/templates/types";

export interface IssueUpdateChange {
  /** Anzeigename des geänderten Felds, z. B. "Priorität", "Titel", "Labels". */
  field: string;
  /** Fehlt er, gilt die Änderung als neu gesetzt statt geändert (z. B. Assignee von niemand). */
  from?: string;
  to: string;
}

export interface IssueUpdateEmailInput {
  to: string;
  actorLabel: string;
  issue: { identifier: string; title: string };
  /** Mehrere Feldänderungen einer Bearbeitung in einer Mail, statt einer je
   *  Feld — wer Titel, Priorität und Labels in einem Zug ändert, soll auch
   *  nur eine Mail auslösen. */
  changes: IssueUpdateChange[];
  url: string;
  manageUrl?: string;
}

/**
 * Für Änderungen, die `notify()` heute nicht abdeckt (Titel, Priorität,
 * Labels, Typ — siehe `type NotificationEvent` in `features/account/types.ts`,
 * das kennt nur `assigned`/`mentioned`/`comment`/`status`/`invite`/`role`).
 * Noch ohne Versandpunkt: dafür bräuchte `notify()` einen neuen Anlass samt
 * `*InApp`/`*Email`-Spaltenpaar in `UserPreferences`, plus die Stelle in
 * `features/issues/actions.ts`, die die alten gegen die neuen Werte
 * vergleicht (wie `notifyStatusChange` es für den Status schon tut).
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
    `${input.issue.identifier} wurde aktualisiert`,
    override?.subject,
    placeholders,
  );
  const heading = resolveText(
    `${input.issue.identifier} wurde aktualisiert`,
    override?.heading,
    placeholders,
  );
  const introText = resolveText(
    `${input.actorLabel} hat ${input.issue.identifier} „${input.issue.title}“ geändert:`,
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
    preheader: `${input.actorLabel} hat ${input.issue.identifier} geändert.`,
    heading: escapeHtml(heading),
    bodyHtml,
    ctaLabel: "Issue öffnen",
    ctaUrl: input.url,
    manageUrl: input.manageUrl,
    recipientEmail: input.to,
  });

  const changesText = input.changes
    .map((c) => `- ${c.field}: ${c.from ? `${c.from} → ${c.to}` : c.to}`)
    .join("\n");

  const text = `${heading}\n\n${introText}\n\n${changesText}\n\nIssue öffnen: ${input.url}`;

  return { subject, html, text };
}
