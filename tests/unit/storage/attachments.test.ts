import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────
// Mockt Geschwister-Module (`config`, `presign`) — wie `avatars.test.ts`. Muss
// deshalb isoliert von `config.test.ts` laufen (siehe package.json).

const CONFIG = {
  endpoint: "http://localhost:9000",
  region: "us-east-1",
  accessKeyId: "id",
  secretAccessKey: "secret",
  bucketAvatars: "avatars",
  bucketIssues: "issues" as string | null,
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
  deleteAttachmentObject,
  finalizeAttachmentUpload,
  requestAttachmentUpload,
  resolveAttachmentUrl,
} from "@/lib/storage/attachments";

function reset() {
  mockStorageConfig.mockReset();
  mockPresignPutUrl.mockReset();
  mockPresignGetUrl.mockReset();
  mockObjectExists.mockReset();
  mockDeleteObjectSafely.mockReset();
  mockStorageConfig.mockReturnValue(CONFIG);
}

describe("requestAttachmentUpload()", () => {
  beforeEach(reset);

  it("lehnt ohne Konfiguration ab", async () => {
    mockStorageConfig.mockReturnValue(null);
    const result = await requestAttachmentUpload({
      issueId: "i-1",
      fileName: "notes.txt",
      contentType: "text/plain",
      contentLength: 100,
    });
    expect(result).toEqual({
      error: "Attachment uploads are not configured.",
    });
    expect(mockPresignPutUrl).not.toHaveBeenCalled();
  });

  it("lehnt ohne S3_BUCKET_ISSUES ab, selbst wenn Avatare konfiguriert sind", async () => {
    mockStorageConfig.mockReturnValue({ ...CONFIG, bucketIssues: null });
    const result = await requestAttachmentUpload({
      issueId: "i-1",
      fileName: "notes.txt",
      contentType: "text/plain",
      contentLength: 100,
    });
    expect(result).toEqual({
      error: "Attachment uploads are not configured.",
    });
    expect(mockPresignPutUrl).not.toHaveBeenCalled();
  });

  it("lehnt zu große Dateien ab", async () => {
    const result = await requestAttachmentUpload({
      issueId: "i-1",
      fileName: "video.mp4",
      contentType: "video/mp4",
      contentLength: 101 * 1024 * 1024,
    });
    expect(result).toEqual({ error: "File is too large (max. 100 MB)." });
    expect(mockPresignPutUrl).not.toHaveBeenCalled();
  });

  it("erlaubt jeden Dateityp — keine MIME-Allowlist wie bei Avataren", async () => {
    mockPresignPutUrl.mockResolvedValue("https://s3.example/put");
    const result = await requestAttachmentUpload({
      issueId: "i-1",
      fileName: "archive.zip",
      contentType: "application/zip",
      contentLength: 100,
    });
    expect(result).toMatchObject({ ok: true });
  });

  it("baut einen Key nach dem Issue-Schema und signiert ihn", async () => {
    mockPresignPutUrl.mockResolvedValue("https://s3.example/put");

    const result = await requestAttachmentUpload({
      issueId: "i-1",
      fileName: "Screenshot 2026.PNG",
      contentType: "image/png",
      contentLength: 100,
    });

    expect(result).toMatchObject({
      ok: true,
      uploadUrl: "https://s3.example/put",
    });
    if (!("ok" in result)) throw new Error("expected ok result");
    expect(result.key).toMatch(/^attachments\/i-1\/[0-9a-f-]{36}\.png$/);
    expect(mockPresignPutUrl).toHaveBeenCalledWith("issues", result.key, {
      contentType: "image/png",
    });
  });

  it("fällt auf 'bin' zurück, wenn der Dateiname keine Endung trägt", async () => {
    mockPresignPutUrl.mockResolvedValue("https://s3.example/put");
    const result = await requestAttachmentUpload({
      issueId: "i-1",
      fileName: "README",
      contentType: "text/plain",
      contentLength: 10,
    });
    if (!("ok" in result)) throw new Error("expected ok result");
    expect(result.key).toMatch(/\.bin$/);
  });
});

describe("finalizeAttachmentUpload()", () => {
  beforeEach(reset);

  it("lehnt einen Key ab, der nicht zum Issue gehört", async () => {
    const result = await finalizeAttachmentUpload(
      "i-1",
      "attachments/i-2/x.png",
    );
    expect(result).toEqual({ error: "Invalid upload key." });
    expect(mockObjectExists).not.toHaveBeenCalled();
  });

  it("lehnt ohne Konfiguration ab", async () => {
    mockStorageConfig.mockReturnValue(null);
    const result = await finalizeAttachmentUpload(
      "i-1",
      "attachments/i-1/x.png",
    );
    expect(result).toEqual({
      error: "Attachment uploads are not configured.",
    });
  });

  it("lehnt ab, wenn das Objekt nicht existiert", async () => {
    mockObjectExists.mockResolvedValue({ exists: false });
    const result = await finalizeAttachmentUpload(
      "i-1",
      "attachments/i-1/x.png",
    );
    expect(result).toEqual({ error: "Upload not found — please try again." });
  });

  it("löscht und lehnt ab, wenn die Datei zu groß ist", async () => {
    mockObjectExists.mockResolvedValue({
      exists: true,
      size: 101 * 1024 * 1024,
    });
    const result = await finalizeAttachmentUpload(
      "i-1",
      "attachments/i-1/x.png",
    );
    expect(result).toEqual({ error: "File is too large (max. 100 MB)." });
    expect(mockDeleteObjectSafely).toHaveBeenCalledWith(
      "issues",
      "attachments/i-1/x.png",
    );
  });

  it("bestätigt ein gültiges Upload und liefert die tatsächliche Größe", async () => {
    mockObjectExists.mockResolvedValue({ exists: true, size: 4096 });
    const result = await finalizeAttachmentUpload(
      "i-1",
      "attachments/i-1/x.png",
    );
    expect(result).toEqual({ ok: true, size: 4096 });
    expect(mockDeleteObjectSafely).not.toHaveBeenCalled();
  });
});

describe("deleteAttachmentObject()", () => {
  beforeEach(reset);

  it("tut nichts ohne Key", async () => {
    await deleteAttachmentObject(null);
    await deleteAttachmentObject(undefined);
    expect(mockDeleteObjectSafely).not.toHaveBeenCalled();
  });

  it("tut nichts ohne Konfiguration", async () => {
    mockStorageConfig.mockReturnValue(null);
    await deleteAttachmentObject("attachments/i-1/x.png");
    expect(mockDeleteObjectSafely).not.toHaveBeenCalled();
  });

  it("löscht über den Issues-Bucket", async () => {
    await deleteAttachmentObject("attachments/i-1/x.png");
    expect(mockDeleteObjectSafely).toHaveBeenCalledWith(
      "issues",
      "attachments/i-1/x.png",
    );
  });
});

describe("resolveAttachmentUrl()", () => {
  beforeEach(reset);

  it("ist null ohne Key", async () => {
    expect(await resolveAttachmentUrl(null)).toBeNull();
    expect(await resolveAttachmentUrl(undefined)).toBeNull();
  });

  it("ist null ohne Konfiguration", async () => {
    mockStorageConfig.mockReturnValue(null);
    expect(await resolveAttachmentUrl("attachments/i-1/x.png")).toBeNull();
  });

  it("signiert eine GET-URL über den Issues-Bucket", async () => {
    mockPresignGetUrl.mockResolvedValue("https://s3.example/get");
    expect(await resolveAttachmentUrl("attachments/i-1/x.png")).toBe(
      "https://s3.example/get",
    );
    expect(mockPresignGetUrl).toHaveBeenCalledWith(
      "issues",
      "attachments/i-1/x.png",
    );
  });
});
