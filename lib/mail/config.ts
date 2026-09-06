import "server-only";

// ─── SMTP configuration ──────────────────────────────────────────────────────
//
// Controlled exclusively through the environment — there's no settings page
// for it, and there shouldn't be: credentials for a mail account don't
// belong in the database. Without `SMTP_HOST`, mail sending stays off; the
// app then keeps running with plain in-app notifications only, same as
// before this file existed.

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  /** Sender address, as it appears in the `From` header. */
  from: string;
}

/**
 * Reads the SMTP configuration from the environment — freshly on every
 * call, not cached: individual tests set `process.env` deliberately for one
 * case and expect the next check to see it too.
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
    from: process.env.SMTP_FROM || `Barynt <no-reply@${host}>`,
  };
}

export function isMailConfigured(): boolean {
  return mailConfig() !== null;
}
