import { describe, expect, it, mock } from "bun:test";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";

// Edge-`auth`-Wrapper simulieren: setzt req.auth anhand eines Test-Cookies
// `authed=1` und delegiert dann an den übergebenen Handler.
mock.module("@/auth.edge", () => ({
  auth:
    (handler: (req: unknown) => unknown) =>
    (req: {
      cookies: { get: (n: string) => { value: string } | undefined };
    }) => {
      (req as unknown as { auth: unknown }).auth =
        req.cookies.get("authed")?.value === "1" ? { user: { id: "u" } } : null;
      return handler(req);
    },
}));

// proxy.ts ruft `auth(...)` bereits zur Import-Zeit auf → dynamisch NACH dem
// mock.module importieren, damit der Mock greift. Der auth-Wrapper hat eine
// Middleware-Signatur; im Test rufen wir ihn als einfache (req)=>Response-Fn auf.
const proxyModule = await import("@/proxy");
const proxy = proxyModule.default as unknown as (
  req: unknown,
) => Promise<Response>;
const { config } = proxyModule;

function makeRequest(path: string, options?: { authed?: boolean }) {
  const headers: Record<string, string> = {};
  if (options?.authed) headers.Cookie = "authed=1";
  const { NextRequest } = require("next/server");
  return new NextRequest(`http://localhost${path}`, { headers });
}

describe("proxy() – Auth-Gate", () => {
  describe("Geschützte Routen ohne Session", () => {
    it("leitet zu /login weiter wenn keine Session vorhanden ist", async () => {
      const response = await proxy(makeRequest("/de/myworkspace/board"));
      expect(response.status).toBe(307);
      expect(response.headers.get("Location") ?? "").toContain("/de/login");
    });

    it("setzt callbackUrl (ohne Locale-Präfix) im Redirect", async () => {
      const response = await proxy(makeRequest("/de/workspace/board"));
      const url = new URL(response.headers.get("Location") ?? "");
      expect(url.searchParams.get("callbackUrl")).toBe("/workspace/board");
    });

    it("verwendet die korrekte Locale im Login-Redirect", async () => {
      const response = await proxy(makeRequest("/en/workspace/board"));
      expect(response.headers.get("Location") ?? "").toContain("/en/login");
    });
  });

  describe("Öffentliche Routen", () => {
    it("leitet auf /login NICHT erneut zum Login (kein callbackUrl)", async () => {
      const response = await proxy(makeRequest("/de/login"));
      const location = response.headers.get("Location") ?? "";
      expect(location).not.toContain("callbackUrl");
    });

    it("lässt /register ohne Session passieren (kein Auth-Redirect)", async () => {
      const response = await proxy(makeRequest("/de/register"));
      const location = response.headers.get("Location") ?? "";
      expect(location).not.toContain("callbackUrl");
    });
  });

  describe("Gültige Session", () => {
    it("leitet eine gültige Session NICHT zum Login um", async () => {
      const response = await proxy(
        makeRequest("/de/myworkspace/board", { authed: true }),
      );
      expect(response.headers.get("Location") ?? "").not.toContain("/login");
    });
  });
});

describe("config.matcher", () => {
  const matches = (url: string) =>
    unstable_doesMiddlewareMatch({ config, url });

  it("läuft auf App-Routen", () => {
    expect(matches("/de/myworkspace/board")).toBe(true);
    expect(matches("/login")).toBe(true);
    expect(matches("/")).toBe(true);
  });

  it("überspringt API, Next-Internals und Dateien mit Endung", () => {
    expect(matches("/api/issues")).toBe(false);
    expect(matches("/_next/static/chunk.js")).toBe(false);
    expect(matches("/favicon.ico")).toBe(false);
  });
});
