import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────
// Mockt Geschwister-Module (`config`, `presign`) — wie `mail/send.test.ts`
// `mail/config` + `mail/transport` mockt. Muss deshalb isoliert von
// `config.test.ts` laufen (siehe package.json).

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

  it("lehnt ohne Konfiguration ab", async () => {
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

  it("lehnt nicht erlaubte Mime-Types ab", async () => {
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

  it("lehnt zu große Dateien ab", async () => {
    const result = await requestAvatarUpload({
      kind: "user",
      ownerId: "u-1",
      contentType: "image/png",
      contentLength: 6 * 1024 * 1024,
    });
    expect(result).toEqual({ error: "File is too large (max. 5 MB)." });
    expect(mockPresignPutUrl).not.toHaveBeenCalled();
  });

  it("baut einen Key nach dem Owner-Schema und signiert ihn", async () => {
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

  it("lehnt einen Key ab, der nicht dem Owner gehört", async () => {
    const result = await finalizeAvatarUpload("user", "u-1", "users/u-2/x.png");
    expect(result).toEqual({ error: "Invalid upload key." });
    expect(mockObjectExists).not.toHaveBeenCalled();
  });

  it("lehnt ohne Konfiguration ab", async () => {
    mockStorageConfig.mockReturnValue(null);
    const result = await finalizeAvatarUpload("user", "u-1", "users/u-1/x.png");
    expect(result).toEqual({ error: "Avatar uploads are not configured." });
  });

  it("lehnt ab, wenn das Objekt nicht existiert", async () => {
    mockObjectExists.mockResolvedValue({ exists: false });
    const result = await finalizeAvatarUpload("user", "u-1", "users/u-1/x.png");
    expect(result).toEqual({ error: "Upload not found — please try again." });
  });

  it("löscht und lehnt ab, wenn die Datei zu groß ist", async () => {
    mockObjectExists.mockResolvedValue({ exists: true, size: 6 * 1024 * 1024 });
    const result = await finalizeAvatarUpload("user", "u-1", "users/u-1/x.png");
    expect(result).toEqual({ error: "File is too large (max. 5 MB)." });
    expect(mockDeleteObjectSafely).toHaveBeenCalledWith(
      "avatars",
      "users/u-1/x.png",
    );
  });

  it("bestätigt ein gültiges Upload", async () => {
    mockObjectExists.mockResolvedValue({ exists: true, size: 100 });
    const result = await finalizeAvatarUpload("user", "u-1", "users/u-1/x.png");
    expect(result).toEqual({ ok: true });
    expect(mockDeleteObjectSafely).not.toHaveBeenCalled();
  });
});

describe("deleteAvatarObject()", () => {
  beforeEach(reset);

  it("tut nichts ohne Key", async () => {
    await deleteAvatarObject(null);
    await deleteAvatarObject(undefined);
    expect(mockDeleteObjectSafely).not.toHaveBeenCalled();
  });

  it("tut nichts ohne Konfiguration", async () => {
    mockStorageConfig.mockReturnValue(null);
    await deleteAvatarObject("users/u-1/x.png");
    expect(mockDeleteObjectSafely).not.toHaveBeenCalled();
  });

  it("löscht über den Avatars-Bucket", async () => {
    await deleteAvatarObject("users/u-1/x.png");
    expect(mockDeleteObjectSafely).toHaveBeenCalledWith(
      "avatars",
      "users/u-1/x.png",
    );
  });
});

describe("resolveAvatarUrl()", () => {
  beforeEach(reset);

  it("ist null ohne Key", async () => {
    expect(await resolveAvatarUrl(null)).toBeNull();
    expect(await resolveAvatarUrl(undefined)).toBeNull();
  });

  it("ist null ohne Konfiguration", async () => {
    mockStorageConfig.mockReturnValue(null);
    expect(await resolveAvatarUrl("users/u-1/x.png")).toBeNull();
  });

  it("signiert eine GET-URL über den Avatars-Bucket", async () => {
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
