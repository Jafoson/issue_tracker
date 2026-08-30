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

// The token carries name and color — after a change it must be refreshed,
// otherwise the menu in the bottom left keeps showing the old state until the
// next login.
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
  // No one else has this username.
  mockUserFindUnique.mockResolvedValue(null);
  mockUserUpdate.mockResolvedValue({ id: ME });
  mockUnstableUpdate.mockResolvedValue(null);
}

describe("updateProfile()", () => {
  beforeEach(reset);

  it("rejects when nobody is logged in", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(await updateProfile(INPUT)).toEqual({
      error: "You must be logged in.",
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("always writes only the user's own account", async () => {
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

  it("requires a first name", async () => {
    expect(await updateProfile({ ...INPUT, firstName: "  " })).toEqual({
      error: "First name is required.",
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("leaves the last name empty — it's optional", async () => {
    expect(await updateProfile({ ...INPUT, lastName: "" })).toEqual({
      ok: true,
    });
    expect(mockUserUpdate.mock.calls[0][0].data.lastName).toBe("");
  });

  it("normalizes the username to lowercase", async () => {
    await updateProfile({ ...INPUT, handle: "  MaraV  " });
    expect(mockUserUpdate.mock.calls[0][0].data.handle).toBe("marav");
  });

  it("rejects usernames with disallowed characters", async () => {
    for (const handle of ["m", "mara vogt", "mara_vogt", "-mara", "mära"]) {
      const result = await updateProfile({ ...INPUT, handle });
      expect(result).toHaveProperty("error");
    }
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("rejects a username someone else already has", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "u-someone-else" });
    expect(await updateProfile(INPUT)).toEqual({
      error: "This username is already taken.",
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("doesn't mind the user's own, unchanged username", async () => {
    mockUserFindUnique.mockResolvedValue({ id: ME });
    expect(await updateProfile(INPUT)).toEqual({ ok: true });
    expect(mockUserUpdate).toHaveBeenCalled();
  });

  it("updates name and color in the session token", async () => {
    await updateProfile(INPUT);
    expect(mockUnstableUpdate).toHaveBeenCalledWith({
      user: { firstName: "Mara", lastName: "Vogt", color: "#6e63e6" },
    });
  });
});
