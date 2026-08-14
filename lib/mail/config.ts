import "server-only";

// ─── SMTP-Konfiguration ───────────────────────────────────────────────────────
//
// Ausschließlich über die Umgebung gesteuert — es gibt keine Einstellungsseite
// dafür und soll auch keine geben: Zugangsdaten für ein Mailkonto gehören nicht
// in die Datenbank. Ohne `SMTP_HOST` bleibt der Mailversand aus; die App läuft
// dann mit reinen In-App-Benachrichtigungen weiter, wie schon vor dieser Datei.

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  /** Absenderadresse, wie sie im `From`-Header steht. */
  from: string;
}

/**
 * Liest die SMTP-Konfiguration aus der Umgebung — bei jedem Aufruf neu, nicht
 * gecacht: einzelne Tests setzen `process.env` gezielt für einen Fall und
 * erwarten, dass die nächste Prüfung das auch sieht.
 */
export function mailConfig(): MailConfig | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  return {
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || undefined,
    pass: process.env.SMTP_PASS || undefined,
    from: process.env.SMTP_FROM || `Issue Tracker <no-reply@${host}>`,
  };
}

export function isMailConfigured(): boolean {
  return mailConfig() !== null;
}
