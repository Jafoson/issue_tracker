import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUserFindUnique = mock();
const mockUserUpdate = mock();
const mockAccountDeleteMany = mock();

mock.module("@/lib/db", () => ({
  db: {
    user: { findUnique: mockUserFindUnique, update: mockUserUpdate },
    account: { deleteMany: mockAccountDeleteMany },
  },
}));

const mockGetSession = mock();
mock.module("@/lib/session", () => ({ getSession: mockGetSession }));
mock.module("@/auth", () => ({ unstable_update: mock() }));
mock.module("next/cache", () => ({ revalidatePath: mock() }));

// bcrypt bleibt echt: `changePassword` steht und fällt damit, dass das alte
// Passwort wirklich geprüft wird — ein Mock würde genau diese Zusage wegnehmen.
import bcrypt from "bcryptjs";

import { changePassword, disconnectAccount } from "@/features/account/actions";

const ME = "u-me";
const OLD = "altes-passwort";

let oldHash = "";

function reset() {
  for (const m of [
    mockUserFindUnique,
    mockUserUpdate,
    mockAccountDeleteMany,
    mockGetSession,
  ]) {
    m.mockReset();
  }
  mockGetSession.mockResolvedValue({ userId: ME });
  mockUserUpdate.mockResolvedValue({ id: ME });
  mockAccountDeleteMany.mockResolvedValue({ count: 1 });
}

describe("changePassword()", () => {
  beforeEach(async () => {
    reset();
    oldHash ||= await bcrypt.hash(OLD, 10);
    mockUserFindUnique.mockResolvedValue({ passwordHash: oldHash });
  });

  it("lehnt ab, wenn niemand eingeloggt ist", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(
      await changePassword({ current: OLD, next: "neues-passwort" }),
    ).toEqual({ error: "You must be logged in." });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("verlangt mindestens acht Zeichen", async () => {
    expect(await changePassword({ current: OLD, next: "kurz" })).toEqual({
      error: "The new password must be at least 8 characters long.",
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("verlangt das aktuelle Passwort, wenn es eines gibt", async () => {
    expect(
      await changePassword({ current: "", next: "neues-passwort" }),
    ).toEqual({ error: "Please enter your current password." });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("lehnt ein falsches aktuelles Passwort ab", async () => {
    expect(
      await changePassword({ current: "geraten", next: "neues-passwort" }),
    ).toEqual({ error: "The current password is not correct." });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("speichert das neue Passwort als Hash, nie im Klartext", async () => {
    expect(
      await changePassword({ current: OLD, next: "neues-passwort" }),
    ).toEqual({ ok: true });

    const written = mockUserUpdate.mock.calls[0][0];
    expect(written.where).toEqual({ id: ME });
    expect(written.data.passwordHash).not.toBe("neues-passwort");
    expect(
      await bcrypt.compare("neues-passwort", written.data.passwordHash),
    ).toBe(true);
  });

  // Wer über GitHub oder Google gekommen ist, hat kein altes Passwort — dann
  // gibt es auch nichts zu bestätigen außer der Sitzung selbst.
  it("setzt ohne bestehendes Passwort das erste, ohne nach dem alten zu fragen", async () => {
    mockUserFindUnique.mockResolvedValue({ passwordHash: null });
    expect(
      await changePassword({ current: "", next: "erstes-passwort" }),
    ).toEqual({ ok: true });
    expect(mockUserUpdate).toHaveBeenCalled();
  });
});

describe("disconnectAccount()", () => {
  beforeEach(reset);

  it("lehnt ab, wenn niemand eingeloggt ist", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(await disconnectAccount("github")).toEqual({
      error: "You must be logged in.",
    });
    expect(mockAccountDeleteMany).not.toHaveBeenCalled();
  });

  it("lehnt ab, was gar nicht verbunden ist", async () => {
    mockUserFindUnique.mockResolvedValue({
      passwordHash: "hash",
      accounts: [{ provider: "google" }],
    });
    expect(await disconnectAccount("github")).toEqual({
      error: "This account is not connected.",
    });
    expect(mockAccountDeleteMany).not.toHaveBeenCalled();
  });

  // Die Oberfläche blendet den Knopf aus — eine Server Function ist trotzdem
  // eine Adresse wie jede andere.
  it("lässt den letzten Weg herein nicht trennen", async () => {
    mockUserFindUnique.mockResolvedValue({
      passwordHash: null,
      accounts: [{ provider: "github" }],
    });
    expect(await disconnectAccount("github")).toHaveProperty("error");
    expect(mockAccountDeleteMany).not.toHaveBeenCalled();
  });

  it("trennt, solange ein Passwort bleibt", async () => {
    mockUserFindUnique.mockResolvedValue({
      passwordHash: "hash",
      accounts: [{ provider: "github" }],
    });
    expect(await disconnectAccount("github")).toEqual({ ok: true });
    expect(mockAccountDeleteMany).toHaveBeenCalledWith({
      where: { userId: ME, provider: "github" },
    });
  });

  it("trennt, solange ein anderer Anbieter bleibt", async () => {
    mockUserFindUnique.mockResolvedValue({
      passwordHash: null,
      accounts: [{ provider: "github" }, { provider: "google" }],
    });
    expect(await disconnectAccount("github")).toEqual({ ok: true });
    expect(mockAccountDeleteMany).toHaveBeenCalled();
  });
});
