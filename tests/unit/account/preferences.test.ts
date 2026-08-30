import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUpsert = mock();

mock.module("@/lib/db", () => ({
  db: { userPreferences: { upsert: mockUpsert } },
}));

const mockGetSession = mock();
mock.module("@/lib/session", () => ({ getSession: mockGetSession }));
mock.module("@/auth", () => ({ unstable_update: mock() }));
mock.module("next/cache", () => ({ revalidatePath: mock() }));

import { setNotification, updateAppearance } from "@/features/account/actions";
import type { NotificationKey } from "@/features/account/types";

const ME = "u-me";

function reset() {
  for (const m of [mockUpsert, mockGetSession]) m.mockReset();
  mockGetSession.mockResolvedValue({ userId: ME });
  mockUpsert.mockResolvedValue({ userId: ME });
}

describe("updateAppearance()", () => {
  beforeEach(reset);

  it("rejects when nobody is logged in", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(await updateAppearance({ theme: "light" })).toEqual({
      error: "You must be logged in.",
    });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  // The value ends up as `data-theme` on the document — whatever got through
  // here would end up in the HTML.
  it("only lets known values through", async () => {
    expect(
      await updateAppearance({ theme: "neon" as unknown as "dark" }),
    ).toEqual({ error: "Unknown theme." });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  // The row is only created on the first change; anything not specified stays
  // at the `@default` from the schema.
  it("creates the row if there isn't one yet", async () => {
    expect(await updateAppearance({ theme: "system" })).toEqual({ ok: true });
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { userId: ME },
      create: { userId: ME, theme: "system" },
      update: { theme: "system" },
    });
  });

  // Nothing to change is not an error — the row stays as it is.
  it("writes nothing when no value is given", async () => {
    expect(await updateAppearance({})).toEqual({ ok: true });
    expect(mockUpsert.mock.calls[0][0].update).toEqual({});
  });
});

describe("setNotification()", () => {
  beforeEach(reset);

  it("rejects when nobody is logged in", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(await setNotification("assignedInApp", false)).toEqual({
      error: "You must be logged in.",
    });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  // The key becomes the column name — anything not in the table
  // is left out.
  it("only lets known toggles through", async () => {
    expect(
      await setNotification("passwordHash" as NotificationKey, true),
    ).toEqual({ error: "Unknown setting." });
    expect(
      await setNotification("assignedSms" as NotificationKey, true),
    ).toEqual({ error: "Unknown setting." });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("writes exactly the one toggle", async () => {
    expect(await setNotification("commentEmail", true)).toEqual({ ok: true });
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { userId: ME },
      create: { userId: ME, commentEmail: true },
      update: { commentEmail: true },
    });
  });

  it("knows every occasion in both channels", async () => {
    const keys: NotificationKey[] = [
      "assignedInApp",
      "assignedEmail",
      "mentionedInApp",
      "mentionedEmail",
      "commentInApp",
      "commentEmail",
      "statusInApp",
      "statusEmail",
      "inviteInApp",
      "inviteEmail",
    ];
    for (const key of keys) {
      expect(await setNotification(key, false)).toEqual({ ok: true });
    }
    expect(mockUpsert).toHaveBeenCalledTimes(keys.length);
  });
});
