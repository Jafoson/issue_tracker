import { describe, expect, it } from "bun:test";
import {
  attachmentObjectKey,
  avatarObjectKey,
  isOwnAttachmentKey,
  isOwnAvatarKey,
  sanitizeAttachmentExt,
} from "@/lib/storage/keys";

describe("avatarObjectKey()", () => {
  it("builds the key from kind, owner id, and a random suffix", () => {
    const key = avatarObjectKey("user", "u-1", "png");
    expect(key).toMatch(/^users\/u-1\/[0-9a-f-]{36}\.png$/);
  });

  it("generates a new key on every call — no in-place overwrite", () => {
    const a = avatarObjectKey("workspace", "acme", "webp");
    const b = avatarObjectKey("workspace", "acme", "webp");
    expect(a).not.toBe(b);
  });
});

describe("isOwnAvatarKey()", () => {
  it("recognizes a key belonging to the correct owner", () => {
    expect(isOwnAvatarKey("user", "u-1", "users/u-1/abc.png")).toBe(true);
  });

  it("rejects a key belonging to a different owner", () => {
    expect(isOwnAvatarKey("user", "u-1", "users/u-2/abc.png")).toBe(false);
  });

  it("rejects a key of the wrong kind", () => {
    expect(isOwnAvatarKey("user", "acme", "workspaces/acme/abc.png")).toBe(
      false,
    );
  });
});

describe("sanitizeAttachmentExt()", () => {
  it("reads the extension from the original filename", () => {
    expect(sanitizeAttachmentExt("logs.txt")).toBe("txt");
  });

  it("lowercases and strips disallowed characters", () => {
    expect(sanitizeAttachmentExt("Screenshot 2026.PNG")).toBe("png");
  });

  it("falls back to 'bin' without an extension", () => {
    expect(sanitizeAttachmentExt("README")).toBe("bin");
  });

  it("falls back to 'bin' when it ends with a dot", () => {
    expect(sanitizeAttachmentExt("archive.")).toBe("bin");
  });

  it("truncates an unusually long extension", () => {
    expect(sanitizeAttachmentExt(`x.${"a".repeat(20)}`)).toHaveLength(10);
  });
});

describe("attachmentObjectKey()", () => {
  it("builds the key from the issue id and a random suffix", () => {
    const key = attachmentObjectKey("i-1", "pdf");
    expect(key).toMatch(/^attachments\/i-1\/[0-9a-f-]{36}\.pdf$/);
  });

  it("generates a new key on every call — no in-place overwrite", () => {
    const a = attachmentObjectKey("i-1", "zip");
    const b = attachmentObjectKey("i-1", "zip");
    expect(a).not.toBe(b);
  });
});

describe("isOwnAttachmentKey()", () => {
  it("recognizes a key belonging to the correct issue", () => {
    expect(isOwnAttachmentKey("i-1", "attachments/i-1/abc.png")).toBe(true);
  });

  it("rejects a key belonging to a different issue", () => {
    expect(isOwnAttachmentKey("i-1", "attachments/i-2/abc.png")).toBe(false);
  });
});
