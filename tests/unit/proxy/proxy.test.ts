import { beforeEach, describe, expect, it, mock } from "bun:test";

mock.module("jose", () => ({
  jwtVerify: mock(),
}));

mock.module("@/lib/session-secret", () => ({
  sessionSecret: new TextEncoder().encode(
    "test-secret-minimum-32-chars-long!!",
  ),
}));

import { jwtVerify } from "jose";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import proxy, { config } from "@/proxy";

const mockJwtVerify = jwtVerify as ReturnType<typeof mock>;

function makeRequest(path: string, options?: { cookie?: string }) {
  const headers: Record<string, string> = {};
  if (options?.cookie) headers.Cookie = options.cookie;
  const { NextRequest } = require("next/server");
  return new NextRequest(`http://localhost${path}`, { headers });
}

describe("proxy() – Auth-Gate", () => {
  beforeEach(() => {
    mockJwtVerify.mockReset();
  });

  describe("Geschützte Routen ohne Session", () => {
    it("leitet zu /login weiter wenn kein Session-Cookie vorhanden ist", async () => {
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

    it("leitet weiter wenn Session-Token ungültig ist", async () => {
      mockJwtVerify.mockRejectedValue(new Error("Invalid token"));
      const response = await proxy(
        makeRequest("/de/dashboard", { cookie: "session=invalid-token" }),
      );
      expect(response.status).toBe(307);
      expect(response.headers.get("Location") ?? "").toContain("/de/login");
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
    beforeEach(() => {
      mockJwtVerify.mockResolvedValue({ payload: { sub: "user-id" } });
    });

    it("ruft jwtVerify mit dem Session-Token auf", async () => {
      await proxy(makeRequest("/de/workspace", { cookie: "session=my-token" }));
      expect(mockJwtVerify).toHaveBeenCalledWith("my-token", expect.anything());
    });

    it("leitet eine gültige Session NICHT zum Login um", async () => {
      const response = await proxy(
        makeRequest("/de/myworkspace/board", { cookie: "session=valid-token" }),
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
