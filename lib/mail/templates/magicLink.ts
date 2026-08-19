import { escapeHtml } from "@/lib/mail/templates/html";
import { renderLayout } from "@/lib/mail/templates/layout";
import type { MailContent } from "@/lib/mail/templates/types";

export interface MagicLinkEmailInput {
  to: string;
  url: string;
  /** Derselbe Wert wie der `token` in `url` — roh, ohne Trennzeichen (die
   *  Anzeige gruppiert ihn nur fürs Auge). Eingegeben auf der Login-Seite,
   *  landet er als `?token=` an genau derselben Callback-Route, die der
   *  Link auch ansteuert — zwei Wege zum selben Ziel, kein zweites Geheimnis. */
  code: string;
  /** Für die Fußzeile — next-auth liefert nur eine Minutenzahl über
   *  `AUTH_EMAIL_MAX_AGE`, hier fest auf den next-auth-Standard (24h). */
  expiresInMinutes: number;
}

/**
 * Der Anmeldelink selbst — verschickt von `next-auth/providers/nodemailer`s
 * `sendVerificationRequest`-Hook (`auth.ts`), nicht über `lib/mail/index.ts`.
 * Anders als die übrigen Vorlagen ohne `TemplateOverride`: der Text ist
 * sicherheitsrelevant (Ablauffrist, „niemandem weitergeben") und soll sich
 * nicht per Admin-Override verändern lassen.
 */
export function magicLinkEmail(input: MagicLinkEmailInput): MailContent {
  const heading = "Dein Anmeldelink für Orbit";
  const introText =
    "Mit diesem Link meldest du dich an — er funktioniert nur einmal und läuft danach ab.";
  const formattedCode = `${input.code.slice(0, 4)}-${input.code.slice(4)}`;

  const bodyHtml = `
    <p style="margin: 0;">${escapeHtml(introText)}</p>
    <p style="margin: 20px 0 0; font-size: 13px; color: #6b6b6b;">Auf einem anderen Gerät geöffnet? Gib stattdessen diesen Code auf der Anmeldeseite ein:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 8px 0 0;">
      <tr>
        <td style="border-radius: 6px; background: #eef1e8; padding: 10px 18px; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 20px; font-weight: 700; letter-spacing: 0.12em; color: #1c1c1c;">
          ${escapeHtml(formattedCode)}
        </td>
      </tr>
    </table>`;

  const html = renderLayout({
    preheader: introText,
    heading,
    bodyHtml,
    ctaLabel: "Jetzt anmelden",
    ctaUrl: input.url,
    footnoteHtml: `Link und Code laufen in ${input.expiresInMinutes} Minuten ab. Hast du das nicht angefordert? Dann ignorier diese Mail — niemand kommt ohne diesen Link oder Code in dein Konto.`,
    recipientEmail: input.to,
  });

  const text = [
    heading,
    "",
    introText,
    "",
    `Jetzt anmelden: ${input.url}`,
    `Code: ${formattedCode}`,
    `Läuft in ${input.expiresInMinutes} Minuten ab.`,
  ].join("\n");

  return { subject: "Dein Anmeldelink für Orbit", html, text };
}
