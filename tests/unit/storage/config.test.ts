import { afterEach, describe, expect, it } from "bun:test";
import { isStorageConfigured, storageConfig } from "@/lib/storage/config";

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

afterEach(clearEnv);

describe("storageConfig()", () => {
  it("ist null ohne S3_ENDPOINT — kein Avatar-Upload ohne Konfiguration", () => {
    clearEnv();
    expect(storageConfig()).toBeNull();
    expect(isStorageConfigured()).toBe(false);
  });

  it("ist null, solange Keys oder Bucket fehlen", () => {
    process.env.S3_ENDPOINT = "http://localhost:9000";
    process.env.S3_ACCESS_KEY_ID = "id";
    // Secret und Bucket fehlen noch.
    expect(storageConfig()).toBeNull();
  });

  it("liest Endpoint, Keys und Bucket aus der Umgebung", () => {
    process.env.S3_ENDPOINT = "http://localhost:9000";
    process.env.S3_REGION = "eu-central-1";
    process.env.S3_ACCESS_KEY_ID = "rustfsadmin";
    process.env.S3_SECRET_ACCESS_KEY = "rustfsadmin";
    process.env.S3_BUCKET_AVATARS = "avatars";

    expect(storageConfig()).toEqual({
      endpoint: "http://localhost:9000",
      region: "eu-central-1",
      accessKeyId: "rustfsadmin",
      secretAccessKey: "rustfsadmin",
      bucketAvatars: "avatars",
    });
    expect(isStorageConfigured()).toBe(true);
  });

  it("fällt ohne S3_REGION auf us-east-1 zurück", () => {
    process.env.S3_ENDPOINT = "http://localhost:9000";
    process.env.S3_ACCESS_KEY_ID = "id";
    process.env.S3_SECRET_ACCESS_KEY = "secret";
    process.env.S3_BUCKET_AVATARS = "avatars";

    const config = storageConfig();
    expect(config?.region).toBe("us-east-1");
  });
});
