import { describe, it, expect, mock, beforeEach } from "bun:test";

// next/headers is mocked in tests/setup.ts (preload) because it's a special
// Next.js module that must be intercepted before lib/session.ts is first loaded.
// We access the pre-created mock functions via globalThis.
const jar = (globalThis as any).__mockCookieFns as { set: any; get: any; delete: any };
const mockSet = jar.set;
const mockGet = jar.get;
const mockDelete = jar.delete;

mock.module("jose", () => {
  class MockSignJWT {
    setProtectedHeader(_: unknown) { return this; }
    setIssuedAt() { return this; }
    setExpirationTime(_: unknown) { return this; }
    sign(_: unknown) { return Promise.resolve("mock-jwt-token"); }
  }
  return {
    SignJWT: MockSignJWT,
    jwtVerify: mock(),
  };
});

mock.module("@/lib/session-secret", () => ({
  sessionSecret: new TextEncoder().encode("test-secret-minimum-32-chars-long!!"),
}));

import { createSession, getSession, clearSession } from "@/lib/session";
import { jwtVerify } from "jose";

const mockJwtVerify = jwtVerify as any;

describe("createSession()", () => {
  beforeEach(() => {
    mockSet.mockReset();
  });

  it("setzt httpOnly Session-Cookie", async () => {
    await createSession("user-123");
    expect(mockSet).toHaveBeenCalledWith(
      "session",
      expect.any(String),
      expect.objectContaining({ httpOnly: true })
    );
  });

  it("setzt sameSite lax auf dem Cookie", async () => {
    await createSession("user-123");
    expect(mockSet).toHaveBeenCalledWith(
      "session",
      expect.any(String),
      expect.objectContaining({ sameSite: "lax" })
    );
  });

  it("setzt maxAge auf 30 Tage", async () => {
    await createSession("user-123");
    const maxAge = 60 * 60 * 24 * 30;
    expect(mockSet).toHaveBeenCalledWith(
      "session",
      expect.any(String),
      expect.objectContaining({ maxAge })
    );
  });
});

describe("getSession()", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockJwtVerify.mockReset();
  });

  it("gibt userId zurück wenn Token gültig ist", async () => {
    mockGet.mockReturnValue({ value: "valid-token" });
    mockJwtVerify.mockResolvedValue({ payload: { sub: "user-123" } });
    const session = await getSession();
    expect(session).toEqual({ userId: "user-123" });
  });

  it("gibt null zurück wenn kein Session-Cookie vorhanden ist", async () => {
    mockGet.mockReturnValue(undefined);
    const session = await getSession();
    expect(session).toBeNull();
  });

  it("gibt null zurück wenn Token ungültig ist", async () => {
    mockGet.mockReturnValue({ value: "invalid-token" });
    mockJwtVerify.mockRejectedValue(new Error("Invalid signature"));
    const session = await getSession();
    expect(session).toBeNull();
  });

  it("gibt null zurück wenn payload.sub fehlt", async () => {
    mockGet.mockReturnValue({ value: "token-without-sub" });
    mockJwtVerify.mockResolvedValue({ payload: {} });
    const session = await getSession();
    expect(session).toBeNull();
  });

  it("verifiziert das Token mit dem Session-Secret", async () => {
    mockGet.mockReturnValue({ value: "my-token" });
    mockJwtVerify.mockResolvedValue({ payload: { sub: "user-id" } });
    await getSession();
    expect(mockJwtVerify).toHaveBeenCalledWith("my-token", expect.anything());
  });
});

describe("clearSession()", () => {
  beforeEach(() => {
    mockDelete.mockReset();
  });

  it("löscht den Session-Cookie", async () => {
    await clearSession();
    expect(mockDelete).toHaveBeenCalledWith("session");
  });

  it("gibt undefined zurück", async () => {
    const result = await clearSession();
    expect(result).toBeUndefined();
  });
});
