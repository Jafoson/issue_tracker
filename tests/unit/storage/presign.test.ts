import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────
// Mockt nur `@/lib/storage/client` (kein eigener Test in diesem Segment) —
// `@/lib/storage/config` bleibt echt (wie `config.test.ts`), env-Variablen
// werden direkt gesetzt/gelöscht, damit dieser Test zusammen mit
// `config.test.ts` im selben Prozess laufen kann.

const mockClient = { sign: mock(), fetch: mock() };
const mockGetClient = mock(() => mockClient as unknown);
mock.module("@/lib/storage/client", () => ({ getClient: mockGetClient }));

import {
  deleteObjectSafely,
  objectExists,
  presignGetUrl,
  presignPutUrl,
} from "@/lib/storage/presign";

const S3_VARS = [
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_BUCKET_AVATARS",
] as const;

function clearEnv() {
  for (const name of S3_VARS) delete process.env[name];
}

function setConfigured() {
  process.env.S3_ENDPOINT = "http://localhost:9000";
  process.env.S3_REGION = "us-east-1";
  process.env.S3_ACCESS_KEY_ID = "id";
  process.env.S3_SECRET_ACCESS_KEY = "secret";
  process.env.S3_BUCKET_AVATARS = "avatars";
}

function reset() {
  mockClient.sign.mockReset();
  mockClient.fetch.mockReset();
  mockGetClient.mockReset();
  mockGetClient.mockReturnValue(mockClient);
  setConfigured();
}

afterEach(clearEnv);

describe("presignPutUrl()", () => {
  beforeEach(reset);

  it("liefert null ohne Konfiguration", async () => {
    clearEnv();
    const url = await presignPutUrl("avatars", "users/u-1/a.png", {
      contentType: "image/png",
    });
    expect(url).toBeNull();
    expect(mockClient.sign).not.toHaveBeenCalled();
  });

  it("liefert null ohne konfigurierten Client", async () => {
    mockGetClient.mockReturnValue(null);
    const url = await presignPutUrl("avatars", "users/u-1/a.png", {
      contentType: "image/png",
    });
    expect(url).toBeNull();
  });

  it("signiert eine Path-Style-URL mit X-Amz-Expires=120 und Content-Type-Header", async () => {
    mockClient.sign.mockResolvedValue({ url: "https://signed.example/put" });

    const url = await presignPutUrl("avatars", "users/u-1/a.png", {
      contentType: "image/png",
    });

    expect(url).toBe("https://signed.example/put");
    const [signedUrl, opts] = mockClient.sign.mock.calls[0];
    expect(signedUrl).toBe(
      "http://localhost:9000/avatars/users/u-1/a.png?X-Amz-Expires=120",
    );
    expect(opts).toEqual({
      method: "PUT",
      headers: { "content-type": "image/png" },
      aws: { signQuery: true },
    });
  });

  it('kodiert Sonderzeichen im Key, lässt "/" aber als Pfadtrenner stehen', async () => {
    mockClient.sign.mockResolvedValue({ url: "https://signed.example/put" });
    await presignPutUrl("avatars", "users/u 1/a b.png", {
      contentType: "image/png",
    });
    const [signedUrl] = mockClient.sign.mock.calls[0];
    expect(signedUrl).toBe(
      "http://localhost:9000/avatars/users/u%201/a%20b.png?X-Amz-Expires=120",
    );
  });
});

describe("presignGetUrl()", () => {
  beforeEach(reset);

  it("liefert null ohne Konfiguration", async () => {
    clearEnv();
    expect(await presignGetUrl("avatars", "users/u-1/a.png")).toBeNull();
  });

  it("signiert eine GET-URL mit X-Amz-Expires=3600", async () => {
    mockClient.sign.mockResolvedValue({ url: "https://signed.example/get" });

    const url = await presignGetUrl("avatars", "users/u-1/a.png");

    expect(url).toBe("https://signed.example/get");
    const [signedUrl, opts] = mockClient.sign.mock.calls[0];
    expect(signedUrl).toBe(
      "http://localhost:9000/avatars/users/u-1/a.png?X-Amz-Expires=3600",
    );
    expect(opts).toEqual({ method: "GET", aws: { signQuery: true } });
  });
});

describe("objectExists()", () => {
  beforeEach(reset);

  it("ist false ohne Konfiguration", async () => {
    clearEnv();
    expect(await objectExists("avatars", "users/u-1/a.png")).toEqual({
      exists: false,
    });
  });

  it("liest die Größe aus content-length bei einer erfolgreichen Antwort", async () => {
    mockClient.fetch.mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { "content-length": "1234" },
      }),
    );
    expect(await objectExists("avatars", "users/u-1/a.png")).toEqual({
      exists: true,
      size: 1234,
    });
  });

  it("ist false bei einer Fehlerantwort (z.B. 404)", async () => {
    mockClient.fetch.mockResolvedValue(new Response(null, { status: 404 }));
    expect(await objectExists("avatars", "users/u-1/a.png")).toEqual({
      exists: false,
    });
  });

  it("ist false, wenn fetch wirft", async () => {
    mockClient.fetch.mockRejectedValue(new Error("network error"));
    expect(await objectExists("avatars", "users/u-1/a.png")).toEqual({
      exists: false,
    });
  });
});

describe("deleteObjectSafely()", () => {
  beforeEach(reset);

  it("tut nichts ohne Konfiguration", async () => {
    clearEnv();
    await deleteObjectSafely("avatars", "users/u-1/a.png");
    expect(mockClient.fetch).not.toHaveBeenCalled();
  });

  it("wirft nicht, wenn das Löschen fehlschlägt", async () => {
    mockClient.fetch.mockRejectedValue(new Error("boom"));
    await expect(
      deleteObjectSafely("avatars", "users/u-1/a.png"),
    ).resolves.toBeUndefined();
  });

  it("ruft DELETE auf der Path-Style-URL auf", async () => {
    mockClient.fetch.mockResolvedValue(new Response(null, { status: 204 }));
    await deleteObjectSafely("avatars", "users/u-1/a.png");
    const [url, opts] = mockClient.fetch.mock.calls[0];
    expect(url).toBe("http://localhost:9000/avatars/users/u-1/a.png");
    expect(opts).toEqual({ method: "DELETE" });
  });
});
