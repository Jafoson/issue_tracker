import { beforeEach, describe, expect, it, mock } from "bun:test";

mock.module("@/lib/db", () => ({
  db: {
    user: {
      findUnique: mock(),
      create: mock(),
    },
  },
}));

class AuthError extends Error {}
mock.module("next-auth", () => ({ AuthError }));

mock.module("@/auth", () => ({
  signIn: mock(),
  signOut: mock(),
}));

mock.module("bcryptjs", () => ({
  default: {
    compare: mock(),
    hash: mock(),
  },
}));

import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { register } from "@/features/auth/actions";
import { db } from "@/lib/db";

const mockUserFindUnique = db.user.findUnique as ReturnType<typeof mock>;
const mockUserCreate = db.user.create as ReturnType<typeof mock>;
const mockSignIn = signIn as ReturnType<typeof mock>;
const mockBcryptHash = bcrypt.hash as ReturnType<typeof mock>;

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.append(k, v);
  return fd;
}

describe("register()", () => {
  beforeEach(() => {
    mockUserFindUnique.mockReset();
    mockUserCreate.mockReset();
    mockSignIn.mockReset();
    mockBcryptHash.mockReset();
    // findUnique wird sowohl für den Existenz-Check als auch von generateHandle
    // (Handle-Eindeutigkeit) genutzt → null = frei.
    mockUserFindUnique.mockResolvedValue(null);
    mockBcryptHash.mockResolvedValue("hashed-password");
    mockUserCreate.mockResolvedValue({});
    mockSignIn.mockResolvedValue(undefined);
  });

  describe("Validierung", () => {
    it("gibt Fehler zurück wenn Vorname fehlt", async () => {
      const result = await register(
        makeFormData({
          lastName: "User",
          email: "user@example.com",
          password: "password123",
        }),
      );
      expect(result).toEqual({ error: "All fields are required." });
    });

    it("gibt Fehler zurück wenn Nachname fehlt", async () => {
      const result = await register(
        makeFormData({
          firstName: "Test",
          email: "user@example.com",
          password: "password123",
        }),
      );
      expect(result).toEqual({ error: "All fields are required." });
    });

    it("gibt Fehler zurück wenn Email fehlt", async () => {
      const result = await register(
        makeFormData({
          firstName: "Test",
          lastName: "User",
          password: "password123",
        }),
      );
      expect(result).toEqual({ error: "All fields are required." });
    });

    it("gibt Fehler zurück wenn Passwort fehlt", async () => {
      const result = await register(
        makeFormData({
          firstName: "Test",
          lastName: "User",
          email: "user@example.com",
        }),
      );
      expect(result).toEqual({ error: "All fields are required." });
    });

    it("gibt Fehler zurück wenn Passwort zu kurz ist (< 8 Zeichen)", async () => {
      const result = await register(
        makeFormData({
          firstName: "Test",
          lastName: "User",
          email: "user@example.com",
          password: "short",
        }),
      );
      expect(result).toEqual({
        error: "Password must be at least 8 characters.",
      });
    });

    it("akzeptiert Passwort mit genau 8 Zeichen", async () => {
      const result = await register(
        makeFormData({
          firstName: "Test",
          lastName: "User",
          email: "user@example.com",
          password: "12345678",
        }),
      );
      expect(result).not.toMatchObject({
        error: "Password must be at least 8 characters.",
      });
    });

    it("gibt Fehler zurück bei ungültigem Email-Format", async () => {
      const result = await register(
        makeFormData({
          firstName: "Test",
          lastName: "User",
          email: "not-an-email",
          password: "password123",
        }),
      );
      expect(result).toEqual({ error: "Please enter a valid email address." });
    });

    it("gibt Fehler zurück wenn Email bereits registriert ist", async () => {
      mockUserFindUnique.mockResolvedValueOnce({ id: "existing" });
      const result = await register(
        makeFormData({
          firstName: "Test",
          lastName: "User",
          email: "existing@example.com",
          password: "password123",
        }),
      );
      expect(result).toEqual({
        error: "An account with this email already exists.",
      });
    });
  });

  describe("Erfolgreiche Registrierung", () => {
    it("leitet nach der Registrierung zu create-workspace weiter", async () => {
      const result = await register(
        makeFormData({
          firstName: "Test",
          lastName: "User",
          email: "new@example.com",
          password: "password123",
        }),
      );
      expect(result).toEqual({ redirectTo: "/create-workspace" });
    });

    it("meldet nach der Registrierung über signIn an", async () => {
      await register(
        makeFormData({
          firstName: "Test",
          lastName: "User",
          email: "new@example.com",
          password: "password123",
        }),
      );
      expect(mockSignIn).toHaveBeenCalledTimes(1);
      expect(mockSignIn).toHaveBeenCalledWith("credentials", {
        email: "new@example.com",
        password: "password123",
        redirect: false,
      });
    });

    it("hasht das Passwort mit bcrypt (cost=12)", async () => {
      await register(
        makeFormData({
          firstName: "Test",
          lastName: "User",
          email: "new@example.com",
          password: "mypassword",
        }),
      );
      expect(mockBcryptHash).toHaveBeenCalledWith("mypassword", 12);
    });

    it("erstellt User mit gehashtem Passwort und korrekten Feldern", async () => {
      await register(
        makeFormData({
          firstName: "Test",
          lastName: "User",
          email: "new@example.com",
          password: "password123",
        }),
      );
      expect(mockUserCreate).toHaveBeenCalledTimes(1);
      const createdData = mockUserCreate.mock.calls[0][0].data;
      expect(createdData.firstName).toBe("Test");
      expect(createdData.lastName).toBe("User");
      expect(createdData.email).toBe("new@example.com");
      expect(createdData.passwordHash).toBe("hashed-password");
      expect(createdData.handle).toBeTruthy();
      expect(createdData.color).toBeTruthy();
    });

    it("normalisiert Email zu Kleinbuchstaben", async () => {
      await register(
        makeFormData({
          firstName: "Test",
          lastName: "User",
          email: "User@EXAMPLE.COM",
          password: "password123",
        }),
      );
      const createdData = mockUserCreate.mock.calls[0][0].data;
      expect(createdData.email).toBe("user@example.com");
    });

    it("gibt einen locale-freien Pfad zurück (Locale ergänzt der Client via next-intl)", async () => {
      const result = await register(
        makeFormData({
          firstName: "Test",
          lastName: "User",
          email: "new@example.com",
          password: "password123",
        }),
      );
      expect((result as { redirectTo: string }).redirectTo).toBe(
        "/create-workspace",
      );
    });
  });
});
