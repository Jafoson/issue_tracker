import { beforeEach, describe, expect, it, mock } from "bun:test";

// lib/session.ts is now a thin wrapper over Auth.js `auth()`.
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

  it("returns userId when a session with user.id exists", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-123" } });
    const session = await getSession();
    expect(session).toEqual({ userId: "user-123" });
  });

  it("returns null when no session exists", async () => {
    mockAuth.mockResolvedValue(null);
    const session = await getSession();
    expect(session).toBeNull();
  });

  it("returns null when the session has no user", async () => {
    mockAuth.mockResolvedValue({});
    const session = await getSession();
    expect(session).toBeNull();
  });

  it("returns null when user.id is missing", async () => {
    mockAuth.mockResolvedValue({ user: { name: "Ada" } });
    const session = await getSession();
    expect(session).toBeNull();
  });
});
