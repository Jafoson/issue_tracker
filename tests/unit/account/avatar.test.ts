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

  it("rejects when nobody is logged in", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(
      await requestAvatarUploadUrl({
        contentType: "image/png",
        contentLength: 100,
      }),
    ).toEqual({ error: "You must be logged in." });
    expect(mockRequestAvatarUpload).not.toHaveBeenCalled();
  });

  it("asks lib/storage for the user's own id", async () => {
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

  it("rejects when nobody is logged in", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(await confirmAvatarUpload("users/u-me/new.png")).toEqual({
      error: "You must be logged in.",
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("passes through the error from finalizeAvatarUpload without changing the DB", async () => {
    mockFinalizeAvatarUpload.mockResolvedValue({
      error: "Invalid upload key.",
    });
    expect(await confirmAvatarUpload("users/other/new.png")).toEqual({
      error: "Invalid upload key.",
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("stores the new key and deletes the old one best-effort", async () => {
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

  it("rejects when nobody is logged in", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(await removeAvatar()).toEqual({ error: "You must be logged in." });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("sets the key to null and deletes the old object", async () => {
    expect(await removeAvatar()).toEqual({ ok: true });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: ME },
      data: { avatarKey: null },
    });
    expect(mockDeleteAvatarObject).toHaveBeenCalledWith("users/u-me/old.png");
  });
});
