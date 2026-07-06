import { mock } from "bun:test";

// server-only throws when imported outside of Next.js server context
mock.module("server-only", () => ({}));

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
