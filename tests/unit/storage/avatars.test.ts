import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────
// Mocks sibling modules (`config`, `presign`) — the same way `mail/send.test.ts`
// mocks `mail/config` + `mail/transport`. Must therefore run isolated from
// `config.test.ts` (see package.json).

const CONFIG = {
  endpoint: "http://localhost:9000",
  region: "us-east-1",
  forcePathStyle: true,
  accessKeyId: "id",
  secretAccessKey: "secret",
  bucketAvatars: "avatars",
};

const mockStorageConfig = mock(() => CONFIG as typeof CONFIG | null);
mock.module("@/lib/storage/config", () => ({
  storageConfig: mockStorageConfig,
}));

const mockPresignPutUrl = mock();
const mockPresignGetUrl = mock();
const mockObjectExists = mock();
const mockDeleteObjectSafely = mock();
mock.module("@/lib/storage/presign", () => ({
  presignPutUrl: mockPresignPutUrl,
  presignGetUrl: mockPresignGetUrl,
  objectExists: mockObjectExists,
  deleteObjectSafely: mockDeleteObjectSafely,
}));

import {
  deleteAvatarObject,
  finalizeAvatarUpload,
  requestAvatarUpload,
  resolveAvatarUrl,
} from "@/lib/storage/avatars";

function reset() {
  mockStorageConfig.mockReset();
  mockPresignPutUrl.mockReset();
  mockPresignGetUrl.mockReset();
  mockObjectExists.mockReset();
  mockDeleteObjectSafely.mockReset();
  mockStorageConfig.mockReturnValue(CONFIG);
}

describe("requestAvatarUpload()", () => {
  beforeEach(reset);

  it("rejects without configuration", async () => {
    mockStorageConfig.mockReturnValue(null);
    const result = await requestAvatarUpload({
      kind: "user",
      ownerId: "u-1",
      contentType: "image/png",
      contentLength: 100,
    });
    expect(result).toEqual({ error: "Avatar uploads are not configured." });
    expect(mockPresignPutUrl).not.toHaveBeenCalled();
  });

  it("rejects disallowed MIME types", async () => {
    const result = await requestAvatarUpload({
      kind: "user",
      ownerId: "u-1",
      contentType: "application/pdf",
      contentLength: 100,
    });
    expect(result).toEqual({
      error: "Only PNG, JPEG, WebP or GIF are allowed.",
    });
    expect(mockPresignPutUrl).not.toHaveBeenCalled();
  });

  it("rejects files that are too large", async () => {
    const result = await requestAvatarUpload({
      kind: "user",
      ownerId: "u-1",
      contentType: "image/png",
      contentLength: 6 * 1024 * 1024,
    });
    expect(result).toEqual({ error: "File is too large (max. 5 MB)." });
    expect(mockPresignPutUrl).not.toHaveBeenCalled();
  });

  it("builds a key following the owner schema and signs it", async () => {
    mockPresignPutUrl.mockResolvedValue("https://s3.example/put");

    const result = await requestAvatarUpload({
      kind: "workspace",
      ownerId: "acme",
      contentType: "image/webp",
      contentLength: 100,
    });

    expect(result).toMatchObject({
      ok: true,
      uploadUrl: "https://s3.example/put",
    });
    if (!("ok" in result)) throw new Error("expected ok result");
    expect(result.key).toMatch(/^workspaces\/acme\/[0-9a-f-]{36}\.webp$/);
    expect(mockPresignPutUrl).toHaveBeenCalledWith("avatars", result.key, {
      contentType: "image/webp",
    });
  });
});

describe("finalizeAvatarUpload()", () => {
  beforeEach(reset);

  it("rejects a key that doesn't belong to the owner", async () => {
    const result = await finalizeAvatarUpload("user", "u-1", "users/u-2/x.png");
    expect(result).toEqual({ error: "Invalid upload key." });
    expect(mockObjectExists).not.toHaveBeenCalled();
  });

  it("rejects without configuration", async () => {
    mockStorageConfig.mockReturnValue(null);
    const result = await finalizeAvatarUpload("user", "u-1", "users/u-1/x.png");
    expect(result).toEqual({ error: "Avatar uploads are not configured." });
  });

  it("rejects when the object doesn't exist", async () => {
    mockObjectExists.mockResolvedValue({ exists: false });
    const result = await finalizeAvatarUpload("user", "u-1", "users/u-1/x.png");
    expect(result).toEqual({ error: "Upload not found — please try again." });
  });

  it("deletes and rejects when the file is too large", async () => {
    mockObjectExists.mockResolvedValue({ exists: true, size: 6 * 1024 * 1024 });
    const result = await finalizeAvatarUpload("user", "u-1", "users/u-1/x.png");
    expect(result).toEqual({ error: "File is too large (max. 5 MB)." });
    expect(mockDeleteObjectSafely).toHaveBeenCalledWith(
      "avatars",
      "users/u-1/x.png",
    );
  });

  it("confirms a valid upload", async () => {
    mockObjectExists.mockResolvedValue({ exists: true, size: 100 });
    const result = await finalizeAvatarUpload("user", "u-1", "users/u-1/x.png");
    expect(result).toEqual({ ok: true });
    expect(mockDeleteObjectSafely).not.toHaveBeenCalled();
  });
});

describe("deleteAvatarObject()", () => {
  beforeEach(reset);

  it("does nothing without a key", async () => {
    await deleteAvatarObject(null);
    await deleteAvatarObject(undefined);
    expect(mockDeleteObjectSafely).not.toHaveBeenCalled();
  });

  it("does nothing without configuration", async () => {
    mockStorageConfig.mockReturnValue(null);
    await deleteAvatarObject("users/u-1/x.png");
    expect(mockDeleteObjectSafely).not.toHaveBeenCalled();
  });

  it("deletes via the avatars bucket", async () => {
    await deleteAvatarObject("users/u-1/x.png");
    expect(mockDeleteObjectSafely).toHaveBeenCalledWith(
      "avatars",
      "users/u-1/x.png",
    );
  });
});

describe("resolveAvatarUrl()", () => {
  beforeEach(reset);

  it("is null without a key", async () => {
    expect(await resolveAvatarUrl(null)).toBeNull();
    expect(await resolveAvatarUrl(undefined)).toBeNull();
  });

  it("is null without configuration", async () => {
    mockStorageConfig.mockReturnValue(null);
    expect(await resolveAvatarUrl("users/u-1/x.png")).toBeNull();
  });

  it("signs a GET URL via the avatars bucket", async () => {
    mockPresignGetUrl.mockResolvedValue("https://s3.example/get");
    expect(await resolveAvatarUrl("users/u-1/x.png")).toBe(
      "https://s3.example/get",
    );
    expect(mockPresignGetUrl).toHaveBeenCalledWith(
      "avatars",
      "users/u-1/x.png",
    );
  });
});
