import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUserFindUnique = mock();
const mockAccountDeleteMany = mock();
const mockAuthenticatorDelete = mock();

mock.module("@/lib/db", () => ({
  db: {
    user: { findUnique: mockUserFindUnique },
    account: { deleteMany: mockAccountDeleteMany },
    authenticator: { delete: mockAuthenticatorDelete },
  },
}));

const mockGetSession = mock();
mock.module("@/lib/session", () => ({ getSession: mockGetSession }));
mock.module("@/auth", () => ({ unstable_update: mock() }));
mock.module("next/cache", () => ({ revalidatePath: mock() }));

import { disconnectAccount, removePasskey } from "@/features/account/actions";

const ME = "u-me";

function reset() {
  for (const m of [
    mockUserFindUnique,
    mockAccountDeleteMany,
    mockAuthenticatorDelete,
    mockGetSession,
  ]) {
    m.mockReset();
  }
  mockGetSession.mockResolvedValue({ userId: ME });
  mockAccountDeleteMany.mockResolvedValue({ count: 1 });
  mockAuthenticatorDelete.mockResolvedValue({ credentialID: "cred-1" });
}

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
      accounts: [{ provider: "google" }],
      authenticators: [{ credentialID: "cred-1" }],
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
      accounts: [{ provider: "github" }],
      authenticators: [],
    });
    expect(await disconnectAccount("github")).toHaveProperty("error");
    expect(mockAccountDeleteMany).not.toHaveBeenCalled();
  });

  it("trennt, solange ein Passkey bleibt", async () => {
    mockUserFindUnique.mockResolvedValue({
      accounts: [{ provider: "github" }],
      authenticators: [{ credentialID: "cred-1" }],
    });
    expect(await disconnectAccount("github")).toEqual({ ok: true });
    expect(mockAccountDeleteMany).toHaveBeenCalledWith({
      where: { userId: ME, provider: "github" },
    });
  });

  it("trennt, solange ein anderer Anbieter bleibt", async () => {
    mockUserFindUnique.mockResolvedValue({
      accounts: [{ provider: "github" }, { provider: "google" }],
      authenticators: [],
    });
    expect(await disconnectAccount("github")).toEqual({ ok: true });
    expect(mockAccountDeleteMany).toHaveBeenCalled();
  });
});

describe("removePasskey()", () => {
  beforeEach(reset);

  it("lehnt ab, wenn niemand eingeloggt ist", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(await removePasskey("cred-1")).toEqual({
      error: "You must be logged in.",
    });
    expect(mockAuthenticatorDelete).not.toHaveBeenCalled();
  });

  it("lehnt einen fremden Passkey ab", async () => {
    mockUserFindUnique.mockResolvedValue({
      accounts: [],
      authenticators: [{ credentialID: "cred-2" }],
    });
    expect(await removePasskey("cred-1")).toEqual({
      error: "This passkey is not on your account.",
    });
    expect(mockAuthenticatorDelete).not.toHaveBeenCalled();
  });

  // Kein verbundener Anbieter, nur dieser eine Passkey — ohne ihn käme
  // niemand mehr herein.
  it("lässt den letzten Weg herein nicht entfernen", async () => {
    mockUserFindUnique.mockResolvedValue({
      accounts: [],
      authenticators: [{ credentialID: "cred-1" }],
    });
    expect(await removePasskey("cred-1")).toHaveProperty("error");
    expect(mockAuthenticatorDelete).not.toHaveBeenCalled();
  });

  it("entfernt, solange ein anderer Passkey bleibt", async () => {
    mockUserFindUnique.mockResolvedValue({
      accounts: [],
      authenticators: [{ credentialID: "cred-1" }, { credentialID: "cred-2" }],
    });
    expect(await removePasskey("cred-1")).toEqual({ ok: true });
    expect(mockAuthenticatorDelete).toHaveBeenCalledWith({
      where: { credentialID: "cred-1" },
    });
  });

  it("entfernt, solange ein verbundener Anbieter bleibt", async () => {
    mockUserFindUnique.mockResolvedValue({
      accounts: [{ provider: "github" }],
      authenticators: [{ credentialID: "cred-1" }],
    });
    expect(await removePasskey("cred-1")).toEqual({ ok: true });
    expect(mockAuthenticatorDelete).toHaveBeenCalled();
  });
});
