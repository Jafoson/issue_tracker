import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUserUpdate = mock();
const mockUserFindUnique = mock();

mock.module("@/lib/db", () => ({
  db: {
    user: { update: mockUserUpdate, findUnique: mockUserFindUnique },
  },
}));

const mockGetSession = mock();
mock.module("@/lib/session", () => ({ getSession: mockGetSession }));

// Das Token trägt Name und Farbe — nach einer Änderung muss es nachgezogen
// werden, sonst zeigt das Menü unten links bis zur nächsten Anmeldung den alten
// Stand.
const mockUnstableUpdate = mock();
mock.module("@/auth", () => ({ unstable_update: mockUnstableUpdate }));

mock.module("next/cache", () => ({ revalidatePath: mock() }));

import { updateProfile } from "@/features/account/actions";

const ME = "u-me";

const INPUT = {
  firstName: "Mara",
  lastName: "Vogt",
  handle: "mara",
  color: "#6e63e6",
};

function reset() {
  for (const m of [
    mockUserUpdate,
    mockUserFindUnique,
    mockGetSession,
    mockUnstableUpdate,
  ]) {
    m.mockReset();
  }
  mockGetSession.mockResolvedValue({ userId: ME });
  // Kein anderer trägt den Benutzernamen.
  mockUserFindUnique.mockResolvedValue(null);
  mockUserUpdate.mockResolvedValue({ id: ME });
  mockUnstableUpdate.mockResolvedValue(null);
}

describe("updateProfile()", () => {
  beforeEach(reset);

  it("lehnt ab, wenn niemand eingeloggt ist", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(await updateProfile(INPUT)).toEqual({
      error: "You must be logged in.",
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("schreibt immer nur das eigene Konto", async () => {
    expect(await updateProfile(INPUT)).toEqual({ ok: true });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: ME },
      data: {
        firstName: "Mara",
        lastName: "Vogt",
        handle: "mara",
        color: "#6e63e6",
      },
    });
  });

  it("verlangt einen Vornamen", async () => {
    expect(await updateProfile({ ...INPUT, firstName: "  " })).toEqual({
      error: "First name is required.",
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("lässt den Nachnamen leer — er ist optional", async () => {
    expect(await updateProfile({ ...INPUT, lastName: "" })).toEqual({
      ok: true,
    });
    expect(mockUserUpdate.mock.calls[0][0].data.lastName).toBe("");
  });

  it("normalisiert den Benutzernamen auf Kleinbuchstaben", async () => {
    await updateProfile({ ...INPUT, handle: "  MaraV  " });
    expect(mockUserUpdate.mock.calls[0][0].data.handle).toBe("marav");
  });

  it("lehnt Benutzernamen mit unerlaubten Zeichen ab", async () => {
    for (const handle of ["m", "mara vogt", "mara_vogt", "-mara", "mära"]) {
      const result = await updateProfile({ ...INPUT, handle });
      expect(result).toHaveProperty("error");
    }
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("lehnt einen Benutzernamen ab, den jemand anderes trägt", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "u-someone-else" });
    expect(await updateProfile(INPUT)).toEqual({
      error: "This username is already taken.",
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("stört sich nicht am eigenen, unveränderten Benutzernamen", async () => {
    mockUserFindUnique.mockResolvedValue({ id: ME });
    expect(await updateProfile(INPUT)).toEqual({ ok: true });
    expect(mockUserUpdate).toHaveBeenCalled();
  });

  it("zieht Name und Farbe im Sitzungs-Token nach", async () => {
    await updateProfile(INPUT);
    expect(mockUnstableUpdate).toHaveBeenCalledWith({
      user: { firstName: "Mara", lastName: "Vogt", color: "#6e63e6" },
    });
  });
});
