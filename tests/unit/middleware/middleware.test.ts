import { describe, it, expect, mock, beforeEach } from "bun:test";

mock.module("jose", () => ({
  jwtVerify: mock(),
}));

mock.module("@/lib/session-secret", () => ({
  sessionSecret: new TextEncoder().encode("test-secret-minimum-32-chars-long!!"),
}));

import { middleware } from "@/middleware";
import { jwtVerify } from "jose";

const mockJwtVerify = jwtVerify as any;

function makeRequest(path: string, options?: { cookie?: string }) {
  const headers: Record<string, string> = {};
  if (options?.cookie) headers.Cookie = options.cookie;
  const { NextRequest } = require("next/server");
  return new NextRequest(`http://localhost${path}`, { headers });
}

describe("middleware()", () => {
  beforeEach(() => {
    mockJwtVerify.mockReset();
  });

  describe("Geschützte Routen ohne Session", () => {
    it("leitet zu /login weiter wenn kein Session-Cookie vorhanden ist", async () => {
      const response = await middleware(makeRequest("/de/myworkspace/board"));
      expect(response.status).toBe(307);
      const location = response.headers.get("Location") ?? "";
      expect(location).toContain("/de/login");
    });

    it("setzt callbackUrl korrekt im Redirect", async () => {
      const response = await middleware(makeRequest("/de/workspace/board"));
      const location = response.headers.get("Location") ?? "";
      const url = new URL(location);
      expect(url.searchParams.get("callbackUrl")).toBe("/de/workspace/board");
    });

    it("verwendet die korrekte Locale im Login-Redirect", async () => {
      const response = await middleware(makeRequest("/en/workspace/board"));
      const location = response.headers.get("Location") ?? "";
      expect(location).toContain("/en/login");
    });

    it("leitet weiter wenn Session-Token ungültig ist", async () => {
      mockJwtVerify.mockRejectedValue(new Error("Invalid token"));
      const response = await middleware(makeRequest("/de/dashboard", { cookie: "session=invalid-token" }));
      expect(response.status).toBe(307);
      expect(response.headers.get("Location")).toContain("/de/login");
    });

    it("leitet weiter wenn Session-Token abgelaufen ist", async () => {
      mockJwtVerify.mockRejectedValue(new Error("JWTExpired"));
      const response = await middleware(makeRequest("/de/workspace", { cookie: "session=expired-token" }));
      expect(response.status).toBe(307);
    });
  });

  describe("Öffentliche Routen", () => {
    it("lässt /login ohne Session durch", async () => {
      const response = await middleware(makeRequest("/de/login"));
      expect(response.status).toBe(200);
    });

    it("lässt /register ohne Session durch", async () => {
      const response = await middleware(makeRequest("/de/register"));
      expect(response.status).toBe(200);
    });

    it("lässt /login mit Unterordner durch", async () => {
      const response = await middleware(makeRequest("/de/login/reset"));
      expect(response.status).toBe(200);
    });
  });

  describe("Gültige Session auf geschützten Routen", () => {
    beforeEach(() => {
      mockJwtVerify.mockResolvedValue({ payload: { sub: "user-id" } });
    });

    it("lässt geschützte Route mit gültiger Session durch", async () => {
      const response = await middleware(makeRequest("/de/myworkspace/board", { cookie: "session=valid-token" }));
      expect(response.status).toBe(200);
    });

    it("ruft jwtVerify mit dem Session-Token auf", async () => {
      await middleware(makeRequest("/de/workspace", { cookie: "session=my-token" }));
      expect(mockJwtVerify).toHaveBeenCalledWith("my-token", expect.anything());
    });
  });
});
