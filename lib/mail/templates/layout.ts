import { appUrl } from "@/lib/app-url";
import { escapeHtml } from "@/lib/mail/templates/html";

// ─── Shared frame for all emails ─────────────────────────────────────────────
//
// One layout for every template, instead of letting each email build its
// own HTML — header, footer, button, detail table, and alert box thus
// change in one place. Tables and inline styles instead of a `<style>`
// block: that's what reliably survives in mail clients (Gmail routinely
// strips `<head>` styles, Outlook renders with the Word engine).

// Same lockup as `components/ui/atoms/Logo` (`variant="horizontal"
// color="color"`), referenced by absolute URL instead of imported — mail
// clients load it like any other remote image, not through Next's asset
// pipeline. Intrinsic size 788×260 (see `Logo.tsx`), scaled down for the header.
const LOGO_HEIGHT = 28;
const LOGO_WIDTH = Math.round((788 / 260) * LOGO_HEIGHT);
// Same teal as `--primary` (light theme, styles/colors.scss) — mail has no
// dark mode of its own, so it's always the light-theme tone.
const ACCENT = "#006972";
export const ACCENT_SOFT = "#e7f4f6";
const TEXT = "#1c1c1c";
const MUTED = "#6b6b6b";
const BORDER = "#e4e4e4";
const DANGER = "#8a2f22";
const DANGER_BG = "#fbeae6";
const DANGER_BORDER = "#f0c9c0";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/**
 * Name and address in the footer text — expected by many mail providers
 * (physical address in commercial emails). Without configuration, the line
 * is simply omitted rather than showing a made-up address.
 */
function companyLine(): string | null {
  const name = process.env.MAIL_COMPANY_NAME;
  if (!name) return null;
  const address = process.env.MAIL_COMPANY_ADDRESS;
  return address ? `${name} · ${address}` : name;
}

export interface LayoutInput {
  /** Visible in the client's preview text, not in the body — keep it short. */
  preheader: string;
  /** The large heading directly under the brand. */
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  /** Fine print between the button/content and the footer, e.g. "Don't
   *  recognize this person? Ignore this email." */
  footnoteHtml?: string;
  /** Set = "Manage notifications" links there. Only for emails that
   *  actually hang off a `*Email` setting — an invitation or a password
   *  reset has no toggle you could flip there. */
  manageUrl?: string;
  /** For "This email was sent to …" — the caller knows the recipient,
   *  this file doesn't. */
  recipientEmail?: string;
}

function renderCta(ctaLabel?: string, ctaUrl?: string): string {
  if (!ctaLabel || !ctaUrl) return "";
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0 4px;">
      <tr>
        <td style="border-radius: 6px; background: ${ACCENT};">
          <a href="${escapeHtml(ctaUrl)}" style="display: inline-block; padding: 11px 22px; font-family: ${FONT}; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none;">
            ${escapeHtml(ctaLabel)}
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 12px 0 0; font-family: ${FONT}; font-size: 12px; color: ${MUTED}; word-break: break-all;">
      ${escapeHtml(ctaUrl)}
    </p>`;
}

function renderFooter(input: LayoutInput): string {
  const lines: string[] = [];
  if (input.footnoteHtml) {
    lines.push(
      `<p style="margin: 0 0 12px; font-family: ${FONT}; font-size: 13px; color: ${MUTED};">${input.footnoteHtml}</p>`,
    );
  }

  const company = companyLine();
  const links: string[] = [];
  if (input.manageUrl) {
    links.push(
      `<a href="${escapeHtml(input.manageUrl)}" style="color: ${MUTED};">Manage notifications</a>`,
    );
  }
  if (company || links.length > 0) {
    lines.push(
      `<p style="margin: 0 0 4px; font-family: ${FONT}; font-size: 12px; color: ${MUTED};">${[company ? escapeHtml(company) : null, links.length > 0 ? links.join(" · ") : null].filter(Boolean).join(" · ")}</p>`,
    );
  }

  if (input.recipientEmail) {
    lines.push(
      `<p style="margin: 8px 0 0; font-family: ${FONT}; font-size: 11px; color: ${MUTED}; text-align: center;">This email was sent to ${escapeHtml(input.recipientEmail)}.</p>`,
    );
  }

  if (lines.length === 0) return "";
  return `
    <tr>
      <td style="padding: 20px 28px 0;">
        <hr style="border: none; border-top: 1px solid ${BORDER}; margin: 0 0 16px;" />
        ${lines.join("")}
      </td>
    </tr>`;
}

export function renderLayout(input: LayoutInput): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin: 0; padding: 0; background: #f4f4f2;">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">
      ${escapeHtml(input.preheader)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f4f4f2; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background: #ffffff; border: 1px solid ${BORDER}; border-radius: 12px;">
            <tr>
              <td style="padding: 24px 28px 0;">
                <img src="${appUrl("/Logo/color/Logo_horizontal.svg")}" alt="Barynt" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" style="display: block; width: ${LOGO_WIDTH}px; height: ${LOGO_HEIGHT}px;" />
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 28px 4px; font-family: ${FONT}; font-size: 20px; font-weight: 700; line-height: 1.3; color: ${TEXT};">
                ${input.heading}
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 28px 28px; font-family: ${FONT}; font-size: 14px; line-height: 1.6; color: ${TEXT};">
                ${input.bodyHtml}
                ${renderCta(input.ctaLabel, input.ctaUrl)}
              </td>
            </tr>
            ${renderFooter(input)}
            <tr>
              <td style="height: 24px;"></td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Quiet, sage-tinted box with label/value rows — invitation details,
 *  password reset context, whatever would otherwise be a definition list. */
export function renderDetailTable(
  rows: { label: string; value: string }[],
): string {
  const body = rows
    .map(
      (row) => `
      <tr>
        <td style="padding: 6px 16px 6px 0; font-family: ${FONT}; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: ${MUTED}; white-space: nowrap; vertical-align: top;">
          ${escapeHtml(row.label)}
        </td>
        <td style="padding: 6px 0; font-family: ${FONT}; font-size: 14px; font-weight: 600; color: ${TEXT};">
          ${row.value}
        </td>
      </tr>`,
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${ACCENT_SOFT}; border-radius: 8px; padding: 4px 16px; margin: 4px 0 0;">
      ${body}
    </table>`;
}

/** Red alert box — "Wasn't you?" and similar security notices. */
export function renderAlertBox(titleHtml: string, bodyHtml: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${DANGER_BG}; border: 1px solid ${DANGER_BORDER}; border-radius: 8px; margin: 16px 0 0;">
      <tr>
        <td style="padding: 12px 16px; font-family: ${FONT}; font-size: 13px; line-height: 1.5; color: ${DANGER};">
          <strong>${titleHtml}</strong> ${bodyHtml}
        </td>
      </tr>
    </table>`;
}
