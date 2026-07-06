import { beforeEach, describe, expect, it, mock } from "bun:test";

// lib/session.ts ist jetzt ein dünner Wrapper über Auth.js `auth()`.
mock.module("@/auth", () => ({
  auth: mock(),
}));

import { auth } from "@/auth";
import { getSession } from "@/lib/session";

const mockAuth = auth as unknown as ReturnType<typeof mock>;

describe("getSession()", () => {
  beforeEach(() => {
    mockAuth.mockReset();
  });

  it("gibt userId zurück wenn eine Session mit user.id existiert", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-123" } });
    const session = await getSession();
    expect(session).toEqual({ userId: "user-123" });
  });

  it("gibt null zurück wenn keine Session vorhanden ist", async () => {
    mockAuth.mockResolvedValue(null);
    const session = await getSession();
    expect(session).toBeNull();
  });

  it("gibt null zurück wenn die Session keinen user hat", async () => {
    mockAuth.mockResolvedValue({});
    const session = await getSession();
    expect(session).toBeNull();
  });

  it("gibt null zurück wenn user.id fehlt", async () => {
    mockAuth.mockResolvedValue({ user: { name: "Ada" } });
    const session = await getSession();
    expect(session).toBeNull();
  });
});
