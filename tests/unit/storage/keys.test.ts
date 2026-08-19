import { describe, expect, it } from "bun:test";
import { avatarObjectKey, isOwnAvatarKey } from "@/lib/storage/keys";

describe("avatarObjectKey()", () => {
  it("baut den Key aus Art, Owner-Id und einem zufälligen Suffix", () => {
    const key = avatarObjectKey("user", "u-1", "png");
    expect(key).toMatch(/^users\/u-1\/[0-9a-f-]{36}\.png$/);
  });

  it("erzeugt bei jedem Aufruf einen neuen Key — kein Überschreiben in-place", () => {
    const a = avatarObjectKey("workspace", "acme", "webp");
    const b = avatarObjectKey("workspace", "acme", "webp");
    expect(a).not.toBe(b);
  });
});

describe("isOwnAvatarKey()", () => {
  it("erkennt einen Key des richtigen Owners", () => {
    expect(isOwnAvatarKey("user", "u-1", "users/u-1/abc.png")).toBe(true);
  });

  it("lehnt einen Key eines anderen Owners ab", () => {
    expect(isOwnAvatarKey("user", "u-1", "users/u-2/abc.png")).toBe(false);
  });

  it("lehnt einen Key der falschen Art ab", () => {
    expect(isOwnAvatarKey("user", "acme", "workspaces/acme/abc.png")).toBe(
      false,
    );
  });
});
