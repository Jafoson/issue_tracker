import { beforeEach, describe, expect, it, mock } from "bun:test";

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

mock.module("bcryptjs", () => ({
  default: {
    compare: mock(),
    hash: mock(),
  },
}));

import bcrypt from "bcryptjs";
import { login } from "@/features/auth/actions";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";

const mockUserFindUnique = db.user.findUnique as ReturnType<typeof mock>;
const mockMemberFindFirst = db.workspaceMember.findFirst as ReturnType<
  typeof mock
>;
const mockCreateSession = createSession as ReturnType<typeof mock>;
const mockBcryptCompare = bcrypt.compare as ReturnType<typeof mock>;

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.append(k, v);
  return fd;
}

describe("login()", () => {
  beforeEach(() => {
    mockUserFindUnique.mockReset();
    mockMemberFindFirst.mockReset();
    mockCreateSession.mockReset();
    mockBcryptCompare.mockReset();
  });

  describe("Validierung", () => {
    it("gibt Fehler zurück wenn Email fehlt", async () => {
      const result = await login(makeFormData({ password: "password123" }));
      expect(result).toEqual({ error: "Email and password are required." });
    });

    it("gibt Fehler zurück wenn Passwort fehlt", async () => {
      const result = await login(makeFormData({ email: "user@example.com" }));
      expect(result).toEqual({ error: "Email and password are required." });
    });

    it("gibt Fehler zurück wenn User nicht existiert", async () => {
      mockUserFindUnique.mockResolvedValue(null);
      const result = await login(
        makeFormData({ email: "ghost@example.com", password: "anypassword" }),
      );
      expect(result).toEqual({ error: "Invalid email or password." });
    });

    it("gibt Fehler zurück wenn Passwort falsch ist", async () => {
      mockUserFindUnique.mockResolvedValue({
        id: "1",
        email: "user@example.com",
        passwordHash: "hash",
      });
      mockBcryptCompare.mockResolvedValue(false);
      const result = await login(
        makeFormData({ email: "user@example.com", password: "wrongpassword" }),
      );
      expect(result).toEqual({ error: "Invalid email or password." });
    });
  });

  describe("Erfolgreicher Login", () => {
    beforeEach(() => {
      mockUserFindUnique.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        passwordHash: "hash",
      });
      mockBcryptCompare.mockResolvedValue(true);
      mockCreateSession.mockResolvedValue(undefined);
    });

    it("leitet zu callbackUrl weiter wenn gesetzt", async () => {
      const result = await login(
        makeFormData({
          email: "user@example.com",
          password: "correctpassword",
          callbackUrl: "/de/myworkspace",
        }),
      );
      expect(result).toEqual({ redirectTo: "/de/myworkspace" });
    });

    it("erstellt Session mit der korrekten userId", async () => {
      mockMemberFindFirst.mockResolvedValue(null);
      await login(
        makeFormData({
          email: "user@example.com",
          password: "correctpassword",
        }),
      );
      expect(mockCreateSession).toHaveBeenCalledTimes(1);
      expect(mockCreateSession).toHaveBeenCalledWith("user-1");
    });

    it("leitet zum Workspace weiter wenn User Mitglied ist", async () => {
      mockMemberFindFirst.mockResolvedValue({ workspaceId: "my-workspace" });
      const result = await login(
        makeFormData({
          email: "user@example.com",
          password: "correctpassword",
          locale: "de",
        }),
      );
      expect(result).toEqual({ redirectTo: "/my-workspace" });
    });

    it("leitet zu create-workspace weiter wenn User keinen Workspace hat", async () => {
      mockMemberFindFirst.mockResolvedValue(null);
      const result = await login(
        makeFormData({
          email: "user@example.com",
          password: "correctpassword",
          locale: "de",
        }),
      );
      expect(result).toEqual({ redirectTo: "/create-workspace" });
    });

    it("gibt einen locale-freien Pfad zurück (Locale ergänzt der Client via next-intl)", async () => {
      mockMemberFindFirst.mockResolvedValue(null);
      const result = await login(
        makeFormData({
          email: "user@example.com",
          password: "correctpassword",
        }),
      );
      expect((result as { redirectTo: string }).redirectTo).toBe(
        "/create-workspace",
      );
    });
  });
});
