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
  it("is null without SMTP_HOST — no mail sending without configuration", () => {
    clearEnv();
    expect(mailConfig()).toBeNull();
    expect(isMailConfigured()).toBe(false);
  });

  it("reads host, port, and credentials from the environment", () => {
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

  it("falls back to 587 and a derived sender address without SMTP_PORT/SMTP_FROM", () => {
    process.env.SMTP_HOST = "smtp.example.com";

    const config = mailConfig();
    expect(config?.port).toBe(587);
    expect(config?.secure).toBe(false);
    expect(config?.from).toBe("Issue Tracker <no-reply@smtp.example.com>");
  });
});
