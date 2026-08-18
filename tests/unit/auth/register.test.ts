import { beforeEach, describe, expect, it, mock } from "bun:test";

// Der Tx-Client für die Registrierung: Konto anlegen und — bei einer
// beanspruchten Domain — sofort Workspace-Mitgliedschaft in einem Zug.
//
// `@/lib/project-membership` bleibt bewusst ungemockt: `projectMembership.test.ts`
// und `projectMembers.test.ts` laufen im selben Prozess (siehe CLAUDE.md) und
// verlassen sich auf die echte `enrollInWorkspaceProjects` — ein Mock hier
// würde für den Rest des Prozesses gewinnen und beide falsch testen lassen.
// `project.findMany`/`workspaceMember.findUnique` unten sind deshalb echte
// Aufrufe der echten Funktion, nicht nur Staffage.
const mockTxUserCreate = mock();
const mockWorkspaceDomainFindUnique = mock();
const mockTxWorkspaceMemberCreate = mock();
const mockTxWorkspaceMemberFindUnique = mock();
const mockTxProjectFindMany = mock();
const mockTxProjectMemberCreateMany = mock();
const mockWorkspaceMemberFindFirst = mock();
const mockTransaction = mock();

const mockTx = {
  user: { create: mockTxUserCreate },
  workspaceDomain: { findUnique: mockWorkspaceDomainFindUnique },
  workspaceMember: {
    create: mockTxWorkspaceMemberCreate,
    findUnique: mockTxWorkspaceMemberFindUnique,
  },
  project: { findMany: mockTxProjectFindMany },
  projectMember: { createMany: mockTxProjectMemberCreateMany },
};

mock.module("@/lib/db", () => ({
  db: {
    user: {
      findUnique: mock(),
    },
    workspaceMember: { findFirst: mockWorkspaceMemberFindFirst },
    $transaction: mockTransaction,
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
const mockSignIn = signIn as ReturnType<typeof mock>;
const mockBcryptHash = bcrypt.hash as ReturnType<typeof mock>;
// Für Assertions, die früher `db.user.create` direkt prüften — die
// Registrierung legt das Konto jetzt in einer Transaktion an.
const mockUserCreate = mockTxUserCreate;

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.append(k, v);
  return fd;
}

describe("register()", () => {
  beforeEach(() => {
    mockUserFindUnique.mockReset();
    mockTxUserCreate.mockReset();
    mockWorkspaceDomainFindUnique.mockReset();
    mockTxWorkspaceMemberCreate.mockReset();
    mockTxWorkspaceMemberFindUnique.mockReset();
    mockTxProjectFindMany.mockReset();
    mockTxProjectMemberCreateMany.mockReset();
    mockWorkspaceMemberFindFirst.mockReset();
    mockTransaction.mockReset();
    mockSignIn.mockReset();
    mockBcryptHash.mockReset();

    // findUnique wird sowohl für den Existenz-Check als auch von generateHandle
    // (Handle-Eindeutigkeit) genutzt → null = frei.
    mockUserFindUnique.mockResolvedValue(null);
    mockBcryptHash.mockResolvedValue("hashed-password");
    mockTxUserCreate.mockResolvedValue({ id: "u-new" });
    // Standardlage: keine Domain beansprucht, kein Auto-Join.
    mockWorkspaceDomainFindUnique.mockResolvedValue(null);
    mockTxWorkspaceMemberCreate.mockResolvedValue({});
    // Für den Auto-Join-Fall: `enrollInWorkspaceProjects` läuft echt, findet
    // hier aber nichts zum Eintragen — die Mitgliedschaft selbst ist schon
    // über `tx.workspaceMember.create` oben bewiesen.
    mockTxWorkspaceMemberFindUnique.mockResolvedValue(null);
    mockTxProjectFindMany.mockResolvedValue([]);
    // Standardlage nach der Registrierung: keine Mitgliedschaft →
    // `defaultRedirectFor` schickt nach `/create-workspace`.
    mockWorkspaceMemberFindFirst.mockResolvedValue(null);
    mockTransaction.mockImplementation(
      async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
    );
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

  describe("Domain-Auto-Join", () => {
    it("tritt automatisch bei, wenn die Domain beansprucht ist", async () => {
      mockWorkspaceDomainFindUnique.mockResolvedValue({
        workspaceId: "acme",
      });
      mockWorkspaceMemberFindFirst.mockResolvedValue({
        workspaceId: "acme",
      });

      const result = await register(
        makeFormData({
          firstName: "Test",
          lastName: "User",
          email: "new@acme.com",
          password: "password123",
        }),
      );

      expect(mockWorkspaceDomainFindUnique).toHaveBeenCalledWith({
        where: { domain: "acme.com" },
        select: { workspaceId: true },
      });
      expect(mockTxWorkspaceMemberCreate.mock.calls[0][0].data).toMatchObject({
        workspaceId: "acme",
        userId: "u-new",
        pending: false,
      });
      // Beweist, dass `enrollInWorkspaceProjects` (echt, nicht gemockt) für
      // genau diesen Workspace lief.
      expect(mockTxProjectFindMany).toHaveBeenCalledWith({
        where: { workspaceId: "acme", visibility: "public" },
        select: { id: true },
      });
      // Nicht mehr "/create-workspace" — die Person ist schon in einem Workspace.
      expect(result).toEqual({ redirectTo: "/acme" });
    });

    it("lässt Konten ohne passende Domain unangetastet", async () => {
      mockWorkspaceDomainFindUnique.mockResolvedValue(null);

      await register(
        makeFormData({
          firstName: "Test",
          lastName: "User",
          email: "new@example.com",
          password: "password123",
        }),
      );

      expect(mockTxWorkspaceMemberCreate).not.toHaveBeenCalled();
      expect(mockTxProjectFindMany).not.toHaveBeenCalled();
    });
  });
});
