import { escapeHtml } from "@/lib/mail/templates/html";
import { renderLayout } from "@/lib/mail/templates/layout";
import {
  resolveText,
  type TemplateOverride,
} from "@/lib/mail/templates/override";
import type { MailContent } from "@/lib/mail/templates/types";

export interface WeeklyDigestHighlight {
  identifier: string;
  title: string;
  /** Fertig aufgelöster Name, nicht der Statuskey — die Vorlage kennt die
   *  Workspace-Konfiguration nicht (siehe `humanizeKey` in `templates/html.ts`
   *  für dieselbe Einschränkung bei `notificationEmail`). */
  statusLabel: string;
}

export interface WeeklyDigestEmailInput {
  to: string;
  firstName: string;
  workspaceName: string;
  /** Freitext, z. B. "13.–19. Januar". */
  periodLabel: string;
  assignedOpenCount: number;
  completedCount: number;
  createdCount: number;
  /** Kleine Auswahl, keine vollständige Liste — Reihenfolge und Auswahl
   *  entscheidet der Aufrufer. */
  highlights: WeeklyDigestHighlight[];
  url: string;
  /** Optional, weil es noch keine eigene `*Email`-Spalte für den Digest gibt
   *  (siehe Docstring unten) — ohne Wert bleibt der Link im Fuß weg. */
  manageUrl?: string;
}

function statTile(value: string, label: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #eef1e8; border-radius: 8px; margin: 0 0 8px;">
      <tr>
        <td style="padding: 12px 16px;">
          <div style="font-size: 22px; font-weight: 700; line-height: 1.2;">${escapeHtml(value)}</div>
          <div style="font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: #6b6b6b;">${escapeHtml(label)}</div>
        </td>
      </tr>
    </table>`;
}

/**
 * Noch ohne Versandpunkt — es gibt weder einen wöchentlichen Job noch die
 * Abfrage, die `highlights`/die drei Zähler beisteuern würde, noch eine
 * `*Email`-Spalte in `UserPreferences`, an der ein Ein/Aus hinge (die
 * bestehenden sechs Anlässe in `features/account/types.ts` decken keinen
 * wiederkehrenden Digest ab). Auslastung pro Teammitglied und eine
 * „braucht Aufmerksamkeit“-Liste sind bewusst nicht modelliert — beides
 * bräuchte eine eigene Abfrage, die es heute nicht gibt.
 */
export function weeklyDigestEmail(
  input: WeeklyDigestEmailInput,
  override?: TemplateOverride,
): MailContent {
  const placeholders = {
    firstName: input.firstName,
    workspaceName: input.workspaceName,
    periodLabel: input.periodLabel,
    completedCount: String(input.completedCount),
    assignedOpenCount: String(input.assignedOpenCount),
    createdCount: String(input.createdCount),
  };

  const subject = resolveText(
    `Deine Woche in ${input.workspaceName}: ${input.completedCount} erledigt`,
    override?.subject,
    placeholders,
  );
  const heading = resolveText(
    `Deine Woche in ${input.workspaceName}`,
    override?.heading,
    placeholders,
  );
  const introText = resolveText(
    `${input.periodLabel} — ${input.workspaceName}`,
    override?.bodyText,
    placeholders,
  );

  const highlightsHtml = input.highlights
    .slice(0, 5)
    .map(
      (h) => `
      <tr>
        <td style="padding: 8px 0; border-top: 1px solid #e4e4e4;">
          <span style="font-family: monospace; color: #6b6b6b; font-size: 12px;">${escapeHtml(h.identifier)}</span>
          <div>${escapeHtml(h.title)}</div>
        </td>
        <td style="padding: 8px 0; border-top: 1px solid #e4e4e4; text-align: right; color: #6b6b6b; font-size: 12px; white-space: nowrap;">
          ${escapeHtml(h.statusLabel)}
        </td>
      </tr>`,
    )
    .join("");

  const bodyHtml = `
    <p style="margin: 0 0 16px; color: #6b6b6b;">${escapeHtml(introText)}</p>
    ${statTile(String(input.completedCount), "Erledigt")}
    ${statTile(String(input.assignedOpenCount), "Dir zugewiesen, offen")}
    ${statTile(String(input.createdCount), "Neu angelegt")}
    ${
      highlightsHtml
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 8px;">${highlightsHtml}</table>`
        : ""
    }`;

  const html = renderLayout({
    preheader: `${input.completedCount} erledigt, ${input.assignedOpenCount} offen zugewiesen — ${input.workspaceName}`,
    heading: escapeHtml(heading),
    bodyHtml,
    ctaLabel: "Meine Aufgaben ansehen",
    ctaUrl: input.url,
    manageUrl: input.manageUrl,
    recipientEmail: input.to,
  });

  const highlightsText = input.highlights
    .slice(0, 5)
    .map((h) => `- ${h.identifier} ${h.title} (${h.statusLabel})`)
    .join("\n");

  const text = [
    heading,
    "",
    `Hallo ${input.firstName},`,
    "",
    introText,
    `Erledigt: ${input.completedCount}`,
    `Dir zugewiesen, offen: ${input.assignedOpenCount}`,
    `Neu angelegt: ${input.createdCount}`,
    ...(highlightsText ? ["", highlightsText] : []),
    "",
    `Meine Aufgaben ansehen: ${input.url}`,
  ].join("\n");

  return { subject, html, text };
}
