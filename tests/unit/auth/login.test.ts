import { beforeEach, describe, expect, it, mock } from "bun:test";

mock.module("@/lib/db", () => ({
  db: {
    user: { findUnique: mock() },
    workspaceMember: { findFirst: mock() },
  },
}));

// AuthError-Klasse bereitstellen, damit `error instanceof AuthError` in der Action greift.
class AuthError extends Error {}
mock.module("next-auth", () => ({ AuthError }));

mock.module("@/auth", () => ({
  signIn: mock(),
  signOut: mock(),
}));

import { signIn } from "@/auth";
import { login } from "@/features/auth/actions";
import { db } from "@/lib/db";

const mockUserFindUnique = db.user.findUnique as ReturnType<typeof mock>;
const mockMemberFindFirst = db.workspaceMember.findFirst as ReturnType<
  typeof mock
>;
const mockSignIn = signIn as ReturnType<typeof mock>;

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.append(k, v);
  return fd;
}

describe("login()", () => {
  beforeEach(() => {
    mockUserFindUnique.mockReset();
    mockMemberFindFirst.mockReset();
    mockSignIn.mockReset();
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

    it("gibt Fehler zurück wenn signIn mit AuthError fehlschlägt (falsche Credentials)", async () => {
      mockSignIn.mockRejectedValue(new AuthError());
      const result = await login(
        makeFormData({ email: "ghost@example.com", password: "anypassword" }),
      );
      expect(result).toEqual({ error: "Invalid email or password." });
    });
  });

  describe("Erfolgreicher Login", () => {
    beforeEach(() => {
      mockSignIn.mockResolvedValue(undefined);
    });

    it("meldet über signIn('credentials', …) mit redirect:false an", async () => {
      mockMemberFindFirst.mockResolvedValue(null);
      mockUserFindUnique.mockResolvedValue({ id: "user-1" });
      await login(
        makeFormData({
          email: "user@example.com",
          password: "correctpassword",
        }),
      );
      expect(mockSignIn).toHaveBeenCalledTimes(1);
      expect(mockSignIn).toHaveBeenCalledWith("credentials", {
        email: "user@example.com",
        password: "correctpassword",
        redirect: false,
      });
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

    it("leitet zum Workspace weiter wenn User Mitglied ist", async () => {
      mockUserFindUnique.mockResolvedValue({ id: "user-1" });
      mockMemberFindFirst.mockResolvedValue({ workspaceId: "my-workspace" });
      const result = await login(
        makeFormData({
          email: "user@example.com",
          password: "correctpassword",
        }),
      );
      expect(result).toEqual({ redirectTo: "/my-workspace" });
    });

    it("leitet zu create-workspace weiter wenn User keinen Workspace hat", async () => {
      mockUserFindUnique.mockResolvedValue({ id: "user-1" });
      mockMemberFindFirst.mockResolvedValue(null);
      const result = await login(
        makeFormData({
          email: "user@example.com",
          password: "correctpassword",
        }),
      );
      expect(result).toEqual({ redirectTo: "/create-workspace" });
    });

    it("gibt einen locale-freien Pfad zurück (Locale ergänzt der Client via next-intl)", async () => {
      mockUserFindUnique.mockResolvedValue({ id: "user-1" });
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
