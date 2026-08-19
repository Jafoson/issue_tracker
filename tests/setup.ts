import { mock } from "bun:test";
import { plugin } from "bun";

// server-only throws when imported outside of Next.js server context
mock.module("server-only", () => ({}));

// Bun lädt `.env` für jeden Aufruf automatisch, auch für `bun test` — ein
// lokal für Mailpit & Co. gesetztes SMTP_HOST würde `isMailConfigured()`
// sonst mitten im Unit-Test wahr werden lassen, ohne dass ein Test das
// erwartet oder `@/lib/db` entsprechend mockt. Tests, die den Mailversand
// selbst prüfen (`tests/unit/mail/config.test.ts`), setzen die Variablen
// gezielt selbst.
for (const name of [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
]) {
  delete process.env[name];
}

// Dieselbe Gefahr wie bei SMTP: ein lokal für rustfs gesetztes `.env` würde
// `isStorageConfigured()` mitten im Unit-Test wahr werden lassen.
// `tests/unit/storage/config.test.ts` setzt die Variablen gezielt selbst.
for (const name of [
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_BUCKET_AVATARS",
]) {
  delete process.env[name];
}

// Komponenten importieren ihre SCSS-Module direkt — im Test gibt es keinen
// Bundler dafür. Der Stub liefert für jede Klasse ihren eigenen Namen zurück,
// damit gerenderte Klassennamen lesbar bleiben.
plugin({
  name: "css-module-stub",
  setup(build) {
    build.onLoad({ filter: /\.(css|scss)$/ }, () => ({
      exports: {
        default: new Proxy({}, { get: (_target, key) => String(key) }),
      },
      loader: "object",
    }));
  },
});

// next/headers is a special Next.js module — it must be mocked in the preload
// so the mock is in place before lib/session.ts is imported in any test file.
// The mock functions are exposed via globalThis so session tests can assert on them.
const cookieFns = { set: mock(), get: mock(), delete: mock() };
(
  globalThis as unknown as { __mockCookieFns: typeof cookieFns }
).__mockCookieFns = cookieFns;

const headerFns = { get: mock(), has: mock(), entries: mock(() => []) };

mock.module("next/headers", () => ({
  cookies: () => Promise.resolve(cookieFns),
  // next-auth (via @/auth) importiert `headers` — muss im Mock vorhanden sein.
  headers: () => Promise.resolve(headerFns),
}));
