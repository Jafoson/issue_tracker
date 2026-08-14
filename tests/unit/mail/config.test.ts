import { afterEach, describe, expect, it } from "bun:test";
import { isMailConfigured, mailConfig } from "@/lib/mail/config";

const SMTP_VARS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
] as const;

function clearEnv() {
  for (const name of SMTP_VARS) delete process.env[name];
}

afterEach(clearEnv);

describe("mailConfig()", () => {
  it("ist null ohne SMTP_HOST — kein Mailversand ohne Konfiguration", () => {
    clearEnv();
    expect(mailConfig()).toBeNull();
    expect(isMailConfigured()).toBe(false);
  });

  it("liest Host, Port und Zugangsdaten aus der Umgebung", () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "2525";
    process.env.SMTP_SECURE = "true";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASS = "secret";
    process.env.SMTP_FROM = "Team <team@example.com>";

    expect(mailConfig()).toEqual({
      host: "smtp.example.com",
      port: 2525,
      secure: true,
      user: "user@example.com",
      pass: "secret",
      from: "Team <team@example.com>",
    });
    expect(isMailConfigured()).toBe(true);
  });

  it("fällt ohne SMTP_PORT/SMTP_FROM auf 587 und eine abgeleitete Absenderadresse zurück", () => {
    process.env.SMTP_HOST = "smtp.example.com";

    const config = mailConfig();
    expect(config?.port).toBe(587);
    expect(config?.secure).toBe(false);
    expect(config?.from).toBe("Issue Tracker <no-reply@smtp.example.com>");
  });
});
