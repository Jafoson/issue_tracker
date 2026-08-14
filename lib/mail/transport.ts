import "server-only";
import nodemailer from "nodemailer";
import { type MailConfig, mailConfig } from "@/lib/mail/config";

// Der Transport hält eine Verbindung (bzw. einen Pool) offen und wird deshalb
// wiederverwendet statt bei jeder Mail neu aufgebaut. Ändert sich die
// Konfiguration — etwa weil ein Test sie zwischen zwei Aufrufen umschreibt —
// wird ein neuer Transport erzeugt, statt den alten stillschweigend weiter zu
// benutzen.
let cached: { config: MailConfig; transport: nodemailer.Transporter } | null =
  null;

export function getTransport(): nodemailer.Transporter | null {
  const config = mailConfig();
  if (!config) {
    cached = null;
    return null;
  }

  if (cached && sameConfig(cached.config, config)) return cached.transport;

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  });
  cached = { config, transport };
  return transport;
}

function sameConfig(a: MailConfig, b: MailConfig): boolean {
  return (
    a.host === b.host &&
    a.port === b.port &&
    a.secure === b.secure &&
    a.user === b.user &&
    a.pass === b.pass &&
    a.from === b.from
  );
}
