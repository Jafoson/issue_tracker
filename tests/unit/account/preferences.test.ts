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

  it("lehnt ab, wenn niemand eingeloggt ist", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(await updateAppearance({ theme: "light" })).toEqual({
      error: "You must be logged in.",
    });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  // Der Wert landet als `data-theme` am Dokument — was hier durchkäme, stünde
  // später im HTML.
  it("lässt nur bekannte Werte durch", async () => {
    expect(
      await updateAppearance({ theme: "neon" as unknown as "dark" }),
    ).toEqual({ error: "Unknown theme." });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  // Die Zeile entsteht erst mit der ersten Änderung; alles Ungenannte bleibt
  // beim `@default` aus dem Schema.
  it("legt die Zeile an, wenn es noch keine gibt", async () => {
    expect(await updateAppearance({ theme: "system" })).toEqual({ ok: true });
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { userId: ME },
      create: { userId: ME, theme: "system" },
      update: { theme: "system" },
    });
  });

  // Nichts zu ändern ist kein Fehler — die Zeile bleibt, wie sie ist.
  it("schreibt nichts, wenn kein Wert kommt", async () => {
    expect(await updateAppearance({})).toEqual({ ok: true });
    expect(mockUpsert.mock.calls[0][0].update).toEqual({});
  });
});

describe("setNotification()", () => {
  beforeEach(reset);

  it("lehnt ab, wenn niemand eingeloggt ist", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(await setNotification("assignedInApp", false)).toEqual({
      error: "You must be logged in.",
    });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  // Der Schlüssel wird zum Spaltennamen — alles, was nicht in der Tabelle steht,
  // bleibt draußen.
  it("lässt nur bekannte Schalter durch", async () => {
    expect(
      await setNotification("passwordHash" as NotificationKey, true),
    ).toEqual({ error: "Unknown setting." });
    expect(
      await setNotification("assignedSms" as NotificationKey, true),
    ).toEqual({ error: "Unknown setting." });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("schreibt genau den einen Schalter", async () => {
    expect(await setNotification("commentEmail", true)).toEqual({ ok: true });
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { userId: ME },
      create: { userId: ME, commentEmail: true },
      update: { commentEmail: true },
    });
  });

  it("kennt jeden Anlass in beiden Kanälen", async () => {
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
