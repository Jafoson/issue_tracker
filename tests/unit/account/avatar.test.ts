import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUserFindUnique = mock();
const mockUserUpdate = mock();

mock.module("@/lib/db", () => ({
  db: {
    user: { findUnique: mockUserFindUnique, update: mockUserUpdate },
  },
}));

const mockGetSession = mock();
mock.module("@/lib/session", () => ({ getSession: mockGetSession }));

const mockRequestAvatarUpload = mock();
const mockFinalizeAvatarUpload = mock();
const mockDeleteAvatarObject = mock();
mock.module("@/lib/storage", () => ({
  requestAvatarUpload: mockRequestAvatarUpload,
  finalizeAvatarUpload: mockFinalizeAvatarUpload,
  deleteAvatarObject: mockDeleteAvatarObject,
}));

mock.module("next/cache", () => ({ revalidatePath: mock() }));

import {
  confirmAvatarUpload,
  removeAvatar,
  requestAvatarUploadUrl,
} from "@/features/account/actions";

const ME = "u-me";

function reset() {
  for (const m of [
    mockUserFindUnique,
    mockUserUpdate,
    mockGetSession,
    mockRequestAvatarUpload,
    mockFinalizeAvatarUpload,
    mockDeleteAvatarObject,
  ]) {
    m.mockReset();
  }
  mockGetSession.mockResolvedValue({ userId: ME });
  mockUserFindUnique.mockResolvedValue({ avatarKey: "users/u-me/old.png" });
  mockUserUpdate.mockResolvedValue({ id: ME });
  mockFinalizeAvatarUpload.mockResolvedValue({ ok: true });
  mockDeleteAvatarObject.mockResolvedValue(undefined);
}

describe("requestAvatarUploadUrl()", () => {
  beforeEach(reset);

  it("lehnt ab, wenn niemand eingeloggt ist", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(
      await requestAvatarUploadUrl({
        contentType: "image/png",
        contentLength: 100,
      }),
    ).toEqual({ error: "You must be logged in." });
    expect(mockRequestAvatarUpload).not.toHaveBeenCalled();
  });

  it("fragt lib/storage für die eigene Nutzer-Id an", async () => {
    mockRequestAvatarUpload.mockResolvedValue({
      ok: true,
      key: "users/u-me/new.png",
      uploadUrl: "https://s3.example/put",
    });

    const result = await requestAvatarUploadUrl({
      contentType: "image/png",
      contentLength: 100,
    });

    expect(result).toEqual({
      ok: true,
      key: "users/u-me/new.png",
      uploadUrl: "https://s3.example/put",
    });
    expect(mockRequestAvatarUpload).toHaveBeenCalledWith({
      kind: "user",
      ownerId: ME,
      contentType: "image/png",
      contentLength: 100,
    });
  });
});

describe("confirmAvatarUpload()", () => {
  beforeEach(reset);

  it("lehnt ab, wenn niemand eingeloggt ist", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(await confirmAvatarUpload("users/u-me/new.png")).toEqual({
      error: "You must be logged in.",
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("gibt den Fehler von finalizeAvatarUpload weiter, ohne die DB zu ändern", async () => {
    mockFinalizeAvatarUpload.mockResolvedValue({
      error: "Invalid upload key.",
    });
    expect(await confirmAvatarUpload("users/other/new.png")).toEqual({
      error: "Invalid upload key.",
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("hinterlegt den neuen Key und löscht den alten best-effort", async () => {
    expect(await confirmAvatarUpload("users/u-me/new.png")).toEqual({
      ok: true,
    });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: ME },
      data: { avatarKey: "users/u-me/new.png" },
    });
    expect(mockDeleteAvatarObject).toHaveBeenCalledWith("users/u-me/old.png");
  });
});

describe("removeAvatar()", () => {
  beforeEach(reset);

  it("lehnt ab, wenn niemand eingeloggt ist", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(await removeAvatar()).toEqual({ error: "You must be logged in." });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("setzt den Key auf null und löscht das alte Objekt", async () => {
    expect(await removeAvatar()).toEqual({ ok: true });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: ME },
      data: { avatarKey: null },
    });
    expect(mockDeleteAvatarObject).toHaveBeenCalledWith("users/u-me/old.png");
  });
});
