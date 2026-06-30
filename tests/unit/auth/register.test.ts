import { beforeEach, describe, expect, it, mock } from "bun:test";

mock.module("@/lib/db", () => ({
  db: {
    user: {
      findUnique: mock(),
      create: mock(),
    },
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
import { register } from "@/features/auth/actions";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";

const mockUserFindUnique = db.user.findUnique as ReturnType<typeof mock>;
const mockUserCreate = db.user.create as ReturnType<typeof mock>;
const mockCreateSession = createSession as ReturnType<typeof mock>;
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
    mockCreateSession.mockReset();
    mockBcryptHash.mockReset();
    mockUserFindUnique.mockResolvedValue(null);
    mockBcryptHash.mockResolvedValue("hashed-password");
    mockUserCreate.mockResolvedValue({});
    mockCreateSession.mockResolvedValue(undefined);
  });

  describe("Validierung", () => {
    it("gibt Fehler zurück wenn Name fehlt", async () => {
      const result = await register(
        makeFormData({ email: "user@example.com", password: "password123" }),
      );
      expect(result).toEqual({ error: "All fields are required." });
    });

    it("gibt Fehler zurück wenn Email fehlt", async () => {
      const result = await register(
        makeFormData({ name: "Test User", password: "password123" }),
      );
      expect(result).toEqual({ error: "All fields are required." });
    });

    it("gibt Fehler zurück wenn Passwort fehlt", async () => {
      const result = await register(
        makeFormData({ name: "Test User", email: "user@example.com" }),
      );
      expect(result).toEqual({ error: "All fields are required." });
    });

    it("gibt Fehler zurück wenn Passwort zu kurz ist (< 8 Zeichen)", async () => {
      const result = await register(
        makeFormData({
          name: "Test User",
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
          name: "Test User",
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
          name: "Test User",
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
          name: "Test User",
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
          name: "Test User",
          email: "new@example.com",
          password: "password123",
          locale: "de",
        }),
      );
      expect(result).toEqual({ redirectTo: "/create-workspace" });
    });

    it("erstellt Session nach der Registrierung", async () => {
      await register(
        makeFormData({
          name: "Test User",
          email: "new@example.com",
          password: "password123",
        }),
      );
      expect(mockCreateSession).toHaveBeenCalledTimes(1);
    });

    it("hasht das Passwort mit bcrypt (cost=12)", async () => {
      await register(
        makeFormData({
          name: "Test User",
          email: "new@example.com",
          password: "mypassword",
        }),
      );
      expect(mockBcryptHash).toHaveBeenCalledWith("mypassword", 12);
    });

    it("erstellt User mit gehashtem Passwort und korrekten Feldern", async () => {
      await register(
        makeFormData({
          name: "Test User",
          email: "new@example.com",
          password: "password123",
        }),
      );
      expect(mockUserCreate).toHaveBeenCalledTimes(1);
      const createdData = mockUserCreate.mock.calls[0][0].data;
      expect(createdData.name).toBe("Test User");
      expect(createdData.email).toBe("new@example.com");
      expect(createdData.passwordHash).toBe("hashed-password");
    });

    it("normalisiert Email zu Kleinbuchstaben", async () => {
      await register(
        makeFormData({
          name: "Test User",
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
          name: "Test User",
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
