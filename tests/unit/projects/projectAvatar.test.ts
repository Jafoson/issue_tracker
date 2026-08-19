import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockProjectFindUnique = mock();
const mockProjectUpdate = mock();

mock.module("@/lib/db", () => ({
  db: {
    project: {
      findUnique: mockProjectFindUnique,
      update: mockProjectUpdate,
    },
  },
}));

const mockCan = mock();
const mockCurrentUserId = mock();

mock.module("@/lib/permissions", () => ({
  can: mockCan,
  currentUserId: mockCurrentUserId,
  accessFor: mock(),
  requirePermission: mock(),
  PermissionError: class PermissionError extends Error {},
  assignmentCeiling: () => Number.POSITIVE_INFINITY,
}));

const mockRequestAvatarUpload = mock();
const mockFinalizeAvatarUpload = mock();
const mockDeleteAvatarObject = mock();
mock.module("@/lib/storage", () => ({
  requestAvatarUpload: mockRequestAvatarUpload,
  finalizeAvatarUpload: mockFinalizeAvatarUpload,
  deleteAvatarObject: mockDeleteAvatarObject,
}));

mock.module("@/lib/session", () => ({ getSession: mock() }));
mock.module("next/cache", () => ({ revalidatePath: mock() }));

import {
  confirmProjectAvatarUpload,
  removeProjectAvatar,
  requestProjectAvatarUploadUrl,
} from "@/features/projects/actions";

const PROJECT = "p-1";
const ACTOR = "u-actor";

function reset() {
  for (const m of [
    mockProjectFindUnique,
    mockProjectUpdate,
    mockCan,
    mockCurrentUserId,
    mockRequestAvatarUpload,
    mockFinalizeAvatarUpload,
    mockDeleteAvatarObject,
  ]) {
    m.mockReset();
  }
  mockCurrentUserId.mockResolvedValue(ACTOR);
  mockCan.mockResolvedValue(true);
  mockProjectFindUnique.mockResolvedValue({
    avatarKey: "projects/p-1/old.png",
  });
  mockProjectUpdate.mockResolvedValue({ id: PROJECT });
  mockFinalizeAvatarUpload.mockResolvedValue({ ok: true });
  mockDeleteAvatarObject.mockResolvedValue(undefined);
}

describe("requestProjectAvatarUploadUrl()", () => {
  beforeEach(reset);

  it("lehnt ab ohne Login", async () => {
    mockCurrentUserId.mockResolvedValue(null);
    expect(
      await requestProjectAvatarUploadUrl(PROJECT, {
        contentType: "image/png",
        contentLength: 100,
      }),
    ).toEqual({ error: "You must be logged in." });
    expect(mockRequestAvatarUpload).not.toHaveBeenCalled();
  });

  it("lehnt ohne project.update ab", async () => {
    mockCan.mockResolvedValue(false);
    expect(
      await requestProjectAvatarUploadUrl(PROJECT, {
        contentType: "image/png",
        contentLength: 100,
      }),
    ).toEqual({ error: "You are not allowed to change this project." });
    expect(mockRequestAvatarUpload).not.toHaveBeenCalled();
  });

  it('fragt lib/storage mit kind "project" an', async () => {
    mockRequestAvatarUpload.mockResolvedValue({
      ok: true,
      key: "projects/p-1/new.png",
      uploadUrl: "https://s3.example/put",
    });

    const result = await requestProjectAvatarUploadUrl(PROJECT, {
      contentType: "image/png",
      contentLength: 100,
    });

    expect(result).toEqual({
      ok: true,
      key: "projects/p-1/new.png",
      uploadUrl: "https://s3.example/put",
    });
    expect(mockRequestAvatarUpload).toHaveBeenCalledWith({
      kind: "project",
      ownerId: PROJECT,
      contentType: "image/png",
      contentLength: 100,
    });
  });
});

describe("confirmProjectAvatarUpload()", () => {
  beforeEach(reset);

  it("lehnt ohne project.update ab", async () => {
    mockCan.mockResolvedValue(false);
    expect(
      await confirmProjectAvatarUpload(PROJECT, "projects/p-1/new.png"),
    ).toEqual({ error: "You are not allowed to change this project." });
    expect(mockProjectUpdate).not.toHaveBeenCalled();
  });

  it("gibt den Fehler von finalizeAvatarUpload weiter", async () => {
    mockFinalizeAvatarUpload.mockResolvedValue({
      error: "Invalid upload key.",
    });
    expect(
      await confirmProjectAvatarUpload(PROJECT, "projects/other/new.png"),
    ).toEqual({ error: "Invalid upload key." });
    expect(mockProjectUpdate).not.toHaveBeenCalled();
  });

  it("hinterlegt den neuen Key und löscht den alten best-effort", async () => {
    expect(
      await confirmProjectAvatarUpload(PROJECT, "projects/p-1/new.png"),
    ).toEqual({ ok: true });
    expect(mockProjectUpdate).toHaveBeenCalledWith({
      where: { id: PROJECT },
      data: { avatarKey: "projects/p-1/new.png" },
    });
    expect(mockDeleteAvatarObject).toHaveBeenCalledWith("projects/p-1/old.png");
  });
});

describe("removeProjectAvatar()", () => {
  beforeEach(reset);

  it("lehnt ohne project.update ab", async () => {
    mockCan.mockResolvedValue(false);
    expect(await removeProjectAvatar(PROJECT)).toEqual({
      error: "You are not allowed to change this project.",
    });
    expect(mockProjectUpdate).not.toHaveBeenCalled();
  });

  it("setzt den Key auf null und löscht das alte Objekt", async () => {
    expect(await removeProjectAvatar(PROJECT)).toEqual({ ok: true });
    expect(mockProjectUpdate).toHaveBeenCalledWith({
      where: { id: PROJECT },
      data: { avatarKey: null },
    });
    expect(mockDeleteAvatarObject).toHaveBeenCalledWith("projects/p-1/old.png");
  });
});
