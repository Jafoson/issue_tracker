import { escapeHtml } from "@/lib/mail/templates/html";
import { ACCENT_SOFT, renderLayout } from "@/lib/mail/templates/layout";
import {
  resolveText,
  type TemplateOverride,
} from "@/lib/mail/templates/override";
import type { MailContent } from "@/lib/mail/templates/types";

export interface WeeklyDigestHighlight {
  identifier: string;
  title: string;
  /** Fully resolved name, not the status key — the template doesn't know
   *  the workspace configuration (see `humanizeKey` in `templates/html.ts`
   *  for the same limitation in `notificationEmail`). */
  statusLabel: string;
}

export interface WeeklyDigestEmailInput {
  to: string;
  firstName: string;
  workspaceName: string;
  /** Free text, e.g. "Jan 13–19". */
  periodLabel: string;
  assignedOpenCount: number;
  completedCount: number;
  createdCount: number;
  /** A small selection, not a complete list — order and selection are
   *  decided by the caller. */
  highlights: WeeklyDigestHighlight[];
  url: string;
  /** Optional, because there's no dedicated `*Email` column for the digest
   *  yet (see docstring below) — without a value, the link in the footer is
   *  simply omitted. */
  manageUrl?: string;
}

function statTile(value: string, label: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${ACCENT_SOFT}; border-radius: 8px; margin: 0 0 8px;">
      <tr>
        <td style="padding: 12px 16px;">
          <div style="font-size: 22px; font-weight: 700; line-height: 1.2;">${escapeHtml(value)}</div>
          <div style="font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: #6b6b6b;">${escapeHtml(label)}</div>
        </td>
      </tr>
    </table>`;
}

/**
 * Still without a send point — there's neither a weekly job nor the query
 * that would supply `highlights`/the three counters, nor a `*Email` column
 * in `UserPreferences` for an on/off toggle to hang off (the existing six
 * events in `features/account/types.ts` don't cover a recurring digest).
 * Per-team-member workload and a "needs attention" list are deliberately
 * not modeled — both would need their own query, which doesn't exist today.
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
    `Your week in ${input.workspaceName}: ${input.completedCount} completed`,
    override?.subject,
    placeholders,
  );
  const heading = resolveText(
    `Your week in ${input.workspaceName}`,
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
    ${statTile(String(input.completedCount), "Completed")}
    ${statTile(String(input.assignedOpenCount), "Assigned to you, open")}
    ${statTile(String(input.createdCount), "Newly created")}
    ${
      highlightsHtml
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 8px;">${highlightsHtml}</table>`
        : ""
    }`;

  const html = renderLayout({
    preheader: `${input.completedCount} completed, ${input.assignedOpenCount} open and assigned — ${input.workspaceName}`,
    heading: escapeHtml(heading),
    bodyHtml,
    ctaLabel: "View my issues",
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
    `Hi ${input.firstName},`,
    "",
    introText,
    `Completed: ${input.completedCount}`,
    `Assigned to you, open: ${input.assignedOpenCount}`,
    `Newly created: ${input.createdCount}`,
    ...(highlightsText ? ["", highlightsText] : []),
    "",
    `View my issues: ${input.url}`,
  ].join("\n");

  return { subject, html, text };
}
