import { describe, expect, it, mock } from "bun:test";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";

// Simulate the edge `auth` wrapper: sets req.auth based on a test cookie
// `authed=1` and then delegates to the given handler.
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

// proxy.ts already calls `auth(...)` at import time → import it dynamically
// AFTER the mock.module call, so the mock takes effect. The auth wrapper has
// a middleware signature; in the test we call it as a simple (req)=>Response fn.
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

describe("proxy() – Auth Gate", () => {
  describe("Protected routes without a session", () => {
    it("redirects to /login when no session exists", async () => {
      const response = await proxy(makeRequest("/de/myworkspace/board"));
      expect(response.status).toBe(307);
      expect(response.headers.get("Location") ?? "").toContain("/de/login");
    });

    it("sets callbackUrl (without locale prefix) in the redirect", async () => {
      const response = await proxy(makeRequest("/de/workspace/board"));
      const url = new URL(response.headers.get("Location") ?? "");
      expect(url.searchParams.get("callbackUrl")).toBe("/workspace/board");
    });

    it("uses the correct locale in the login redirect", async () => {
      const response = await proxy(makeRequest("/en/workspace/board"));
      expect(response.headers.get("Location") ?? "").toContain("/en/login");
    });
  });

  describe("Public routes", () => {
    it("does NOT redirect /login to login again (no callbackUrl)", async () => {
      const response = await proxy(makeRequest("/de/login"));
      const location = response.headers.get("Location") ?? "";
      expect(location).not.toContain("callbackUrl");
    });

    it("lets /register through without a session (no auth redirect)", async () => {
      const response = await proxy(makeRequest("/de/register"));
      const location = response.headers.get("Location") ?? "";
      expect(location).not.toContain("callbackUrl");
    });

    // The token in the path is the authorization, and whoever accepts an
    // invitation doesn't have a password yet — an auth gate in front of it
    // would be a door with the key locked behind it.
    it("lets /invite/<token> through without a session", async () => {
      const response = await proxy(makeRequest("/de/invite/abc123"));
      const location = response.headers.get("Location") ?? "";
      expect(location).not.toContain("callbackUrl");
    });
  });

  describe("Valid session", () => {
    it("does NOT redirect a valid session to login", async () => {
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

  it("runs on app routes", () => {
    expect(matches("/de/myworkspace/board")).toBe(true);
    expect(matches("/login")).toBe(true);
    expect(matches("/")).toBe(true);
  });

  it("skips API, Next internals, and files with an extension", () => {
    expect(matches("/api/issues")).toBe(false);
    expect(matches("/_next/static/chunk.js")).toBe(false);
    expect(matches("/favicon.ico")).toBe(false);
  });
});
