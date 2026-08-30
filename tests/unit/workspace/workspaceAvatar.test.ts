import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockWorkspaceFindUnique = mock();
const mockWorkspaceUpdate = mock();

mock.module("@/lib/db", () => ({
  db: {
    workspace: {
      findUnique: mockWorkspaceFindUnique,
      update: mockWorkspaceUpdate,
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
  confirmWorkspaceAvatarUpload,
  removeWorkspaceAvatar,
  requestWorkspaceAvatarUploadUrl,
} from "@/features/workspaces/actions";

const WS = "acme";
const ACTOR = "u-actor";

function reset() {
  for (const m of [
    mockWorkspaceFindUnique,
    mockWorkspaceUpdate,
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
  mockWorkspaceFindUnique.mockResolvedValue({
    avatarKey: "workspaces/acme/old.png",
  });
  mockWorkspaceUpdate.mockResolvedValue({ id: WS });
  mockFinalizeAvatarUpload.mockResolvedValue({ ok: true });
  mockDeleteAvatarObject.mockResolvedValue(undefined);
}

describe("requestWorkspaceAvatarUploadUrl()", () => {
  beforeEach(reset);

  it("rejects without login", async () => {
    mockCurrentUserId.mockResolvedValue(null);
    expect(
      await requestWorkspaceAvatarUploadUrl(WS, {
        contentType: "image/png",
        contentLength: 100,
      }),
    ).toEqual({ error: "You must be logged in." });
    expect(mockRequestAvatarUpload).not.toHaveBeenCalled();
  });

  it("rejects without workspace.update", async () => {
    mockCan.mockResolvedValue(false);
    expect(
      await requestWorkspaceAvatarUploadUrl(WS, {
        contentType: "image/png",
        contentLength: 100,
      }),
    ).toEqual({ error: "You are not allowed to change this workspace." });
    expect(mockRequestAvatarUpload).not.toHaveBeenCalled();
  });

  it('asks lib/storage with kind "workspace"', async () => {
    mockRequestAvatarUpload.mockResolvedValue({
      ok: true,
      key: "workspaces/acme/new.png",
      uploadUrl: "https://s3.example/put",
    });

    const result = await requestWorkspaceAvatarUploadUrl(WS, {
      contentType: "image/png",
      contentLength: 100,
    });

    expect(result).toEqual({
      ok: true,
      key: "workspaces/acme/new.png",
      uploadUrl: "https://s3.example/put",
    });
    expect(mockRequestAvatarUpload).toHaveBeenCalledWith({
      kind: "workspace",
      ownerId: WS,
      contentType: "image/png",
      contentLength: 100,
    });
  });
});

describe("confirmWorkspaceAvatarUpload()", () => {
  beforeEach(reset);

  it("rejects without workspace.update", async () => {
    mockCan.mockResolvedValue(false);
    expect(
      await confirmWorkspaceAvatarUpload(WS, "workspaces/acme/new.png"),
    ).toEqual({ error: "You are not allowed to change this workspace." });
    expect(mockWorkspaceUpdate).not.toHaveBeenCalled();
  });

  it("passes through the error from finalizeAvatarUpload", async () => {
    mockFinalizeAvatarUpload.mockResolvedValue({
      error: "Invalid upload key.",
    });
    expect(
      await confirmWorkspaceAvatarUpload(WS, "workspaces/other/new.png"),
    ).toEqual({ error: "Invalid upload key." });
    expect(mockWorkspaceUpdate).not.toHaveBeenCalled();
  });

  it("stores the new key and deletes the old one on a best-effort basis", async () => {
    expect(
      await confirmWorkspaceAvatarUpload(WS, "workspaces/acme/new.png"),
    ).toEqual({ ok: true });
    expect(mockWorkspaceUpdate).toHaveBeenCalledWith({
      where: { id: WS },
      data: { avatarKey: "workspaces/acme/new.png" },
    });
    expect(mockDeleteAvatarObject).toHaveBeenCalledWith(
      "workspaces/acme/old.png",
    );
  });
});

describe("removeWorkspaceAvatar()", () => {
  beforeEach(reset);

  it("rejects without workspace.update", async () => {
    mockCan.mockResolvedValue(false);
    expect(await removeWorkspaceAvatar(WS)).toEqual({
      error: "You are not allowed to change this workspace.",
    });
    expect(mockWorkspaceUpdate).not.toHaveBeenCalled();
  });

  it("sets the key to null and deletes the old object", async () => {
    expect(await removeWorkspaceAvatar(WS)).toEqual({ ok: true });
    expect(mockWorkspaceUpdate).toHaveBeenCalledWith({
      where: { id: WS },
      data: { avatarKey: null },
    });
    expect(mockDeleteAvatarObject).toHaveBeenCalledWith(
      "workspaces/acme/old.png",
    );
  });
});
