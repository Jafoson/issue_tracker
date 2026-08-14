import { escapeHtml } from "@/lib/mail/templates/html";

// ─── Gemeinsamer Rahmen für alle Mails ────────────────────────────────────────
//
// Ein Layout für jede Vorlage, statt jede Mail ihr eigenes HTML bauen zu
// lassen — Kopf, Fuß, Knopf, Detailtabelle und Warnbox ändern sich damit an
// einer Stelle. Tabellen und Inline-Styles statt einem `<style>`-Block: das
// ist, was in Mail-Clients zuverlässig ankommt (Gmail entfernt `<head>`-Styles
// regelmäßig, Outlook rendert mit der Word-Engine).

const BRAND = "Orbit";
const BRAND_SUFFIX = "Issue Tracker";
const ACCENT = "#6b5e10";
const ACCENT_SOFT = "#eef1e8";
const TEXT = "#1c1c1c";
const MUTED = "#6b6b6b";
const BORDER = "#e4e4e4";
const DANGER = "#8a2f22";
const DANGER_BG = "#fbeae6";
const DANGER_BORDER = "#f0c9c0";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/**
 * Name und Adresse im Fußzeilentext — für viele Mailanbieter erwartet
 * (physische Adresse in kommerziellen Mails). Ohne Konfiguration bleibt die
 * Zeile weg, statt eine erfundene Adresse zu zeigen.
 */
function companyLine(): string | null {
  const name = process.env.MAIL_COMPANY_NAME;
  if (!name) return null;
  const address = process.env.MAIL_COMPANY_ADDRESS;
  return address ? `${name} · ${address}` : name;
}

export interface LayoutInput {
  /** Im Client-Vorschautext sichtbar, im Body nicht — kurz halten. */
  preheader: string;
  /** Die große Überschrift direkt unter der Marke. */
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  /** Kleingedrucktes zwischen Knopf/Inhalt und Fußzeile, z. B. „Kennst du
   *  die Person nicht? Ignorier die Mail.“ */
  footnoteHtml?: string;
  /** Gesetzt = „Benachrichtigungen verwalten“ verlinkt dorthin. Nur bei
   *  Mails, die tatsächlich an einer `*Email`-Einstellung hängen — eine
   *  Einladung oder ein Passwort-Reset hat keinen Schalter, den man dort
   *  umlegen könnte. */
  manageUrl?: string;
  /** Für „Diese E-Mail wurde an … gesendet“ — der Aufrufer kennt den
   *  Empfänger, diese Datei nicht. */
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
      `<a href="${escapeHtml(input.manageUrl)}" style="color: ${MUTED};">Benachrichtigungen verwalten</a>`,
    );
  }
  if (company || links.length > 0) {
    lines.push(
      `<p style="margin: 0 0 4px; font-family: ${FONT}; font-size: 12px; color: ${MUTED};">${[company ? escapeHtml(company) : null, links.length > 0 ? links.join(" · ") : null].filter(Boolean).join(" · ")}</p>`,
    );
  }

  if (input.recipientEmail) {
    lines.push(
      `<p style="margin: 8px 0 0; font-family: ${FONT}; font-size: 11px; color: ${MUTED}; text-align: center;">Diese E-Mail wurde an ${escapeHtml(input.recipientEmail)} gesendet.</p>`,
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
<html lang="de">
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
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width: 26px; height: 26px; border-radius: 6px; background: ${ACCENT}; color: #ffffff; font-family: ${FONT}; font-size: 13px; font-weight: 700; text-align: center; vertical-align: middle;">
                      O
                    </td>
                    <td style="padding-left: 8px; font-family: ${FONT}; font-size: 14px;">
                      <strong>${BRAND}</strong>
                      <span style="color: ${MUTED};">${BRAND_SUFFIX}</span>
                    </td>
                  </tr>
                </table>
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

/** Ruhige, sage-getönte Box mit Label/Wert-Zeilen — Einladungsdetails,
 *  Passwort-Reset-Kontext, was sonst als Definitionsliste liefe. */
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

/** Rote Warnbox — „Warst das nicht du?“ und ähnliche Sicherheitshinweise. */
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
