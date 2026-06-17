import { describe, it, expect, mock, beforeEach } from "bun:test";

mock.module("@/lib/db", () => ({
  db: {
    user: { findUnique: mock() },
    workspaceMember: { findFirst: mock() },
  },
}));

mock.module("@/lib/session", () => ({
  createSession: mock(),
  clearSession: mock(),
  getSession: mock(),
}));

import { logout } from "@/features/auth/actions";
import { clearSession } from "@/lib/session";

const mockClearSession = clearSession as any;

describe("logout()", () => {
  beforeEach(() => {
    mockClearSession.mockReset();
    mockClearSession.mockResolvedValue(undefined);
  });

  it("ruft clearSession auf", async () => {
    await logout();
    expect(mockClearSession).toHaveBeenCalledTimes(1);
  });

  it("gibt keinen Wert zurück", async () => {
    const result = await logout();
    expect(result).toBeUndefined();
  });
});
