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

  it("rejects when nobody is logged in", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(await disconnectAccount("github")).toEqual({
      error: "You must be logged in.",
    });
    expect(mockAccountDeleteMany).not.toHaveBeenCalled();
  });

  it("rejects something that isn't connected at all", async () => {
    mockUserFindUnique.mockResolvedValue({
      accounts: [{ provider: "google" }],
      authenticators: [{ credentialID: "cred-1" }],
    });
    expect(await disconnectAccount("github")).toEqual({
      error: "This account is not connected.",
    });
    expect(mockAccountDeleteMany).not.toHaveBeenCalled();
  });

  // The UI hides the button — but a server function is still an address
  // like any other.
  it("doesn't allow disconnecting the last way in", async () => {
    mockUserFindUnique.mockResolvedValue({
      accounts: [{ provider: "github" }],
      authenticators: [],
    });
    expect(await disconnectAccount("github")).toHaveProperty("error");
    expect(mockAccountDeleteMany).not.toHaveBeenCalled();
  });

  it("disconnects as long as a passkey remains", async () => {
    mockUserFindUnique.mockResolvedValue({
      accounts: [{ provider: "github" }],
      authenticators: [{ credentialID: "cred-1" }],
    });
    expect(await disconnectAccount("github")).toEqual({ ok: true });
    expect(mockAccountDeleteMany).toHaveBeenCalledWith({
      where: { userId: ME, provider: "github" },
    });
  });

  it("disconnects as long as another provider remains", async () => {
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

  it("rejects when nobody is logged in", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(await removePasskey("cred-1")).toEqual({
      error: "You must be logged in.",
    });
    expect(mockAuthenticatorDelete).not.toHaveBeenCalled();
  });

  it("rejects a passkey belonging to someone else", async () => {
    mockUserFindUnique.mockResolvedValue({
      accounts: [],
      authenticators: [{ credentialID: "cred-2" }],
    });
    expect(await removePasskey("cred-1")).toEqual({
      error: "This passkey is not on your account.",
    });
    expect(mockAuthenticatorDelete).not.toHaveBeenCalled();
  });

  // No connected provider, only this one passkey — without it no one
  // could get in anymore.
  it("doesn't allow removing the last way in", async () => {
    mockUserFindUnique.mockResolvedValue({
      accounts: [],
      authenticators: [{ credentialID: "cred-1" }],
    });
    expect(await removePasskey("cred-1")).toHaveProperty("error");
    expect(mockAuthenticatorDelete).not.toHaveBeenCalled();
  });

  it("removes it as long as another passkey remains", async () => {
    mockUserFindUnique.mockResolvedValue({
      accounts: [],
      authenticators: [{ credentialID: "cred-1" }, { credentialID: "cred-2" }],
    });
    expect(await removePasskey("cred-1")).toEqual({ ok: true });
    expect(mockAuthenticatorDelete).toHaveBeenCalledWith({
      where: { credentialID: "cred-1" },
    });
  });

  it("removes it as long as a connected provider remains", async () => {
    mockUserFindUnique.mockResolvedValue({
      accounts: [{ provider: "github" }],
      authenticators: [{ credentialID: "cred-1" }],
    });
    expect(await removePasskey("cred-1")).toEqual({ ok: true });
    expect(mockAuthenticatorDelete).toHaveBeenCalled();
  });
});
