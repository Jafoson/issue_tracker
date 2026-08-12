import { beforeEach, describe, expect, it, mock } from "bun:test";

// Rollenvergabe und Stilllegung auf der Plattform-Ebene. Beides verschiebt
// Rechte, für beides gelten dieselben zwei Regeln: nicht an sich selbst, und
// nicht über den eigenen Rang hinaus.

const mockUserFindUnique = mock();
const mockUserUpdate = mock();
const mockRoleFindUnique = mock();
const mockAuditCreate = mock();

mock.module("@/lib/db", () => ({
  db: {
    user: { findUnique: mockUserFindUnique, update: mockUserUpdate },
    role: { findUnique: mockRoleFindUnique },
    auditLog: { create: mockAuditCreate },
  },
}));
mock.module("next/cache", () => ({ revalidatePath: mock() }));

const mockGetAccess = mock();
const mockCurrentUserId = mock(async () => "admin1");
let ceiling = Number.POSITIVE_INFINITY;

mock.module("@/lib/permissions", () => ({
  getAccess: mockGetAccess,
  currentUserId: mockCurrentUserId,
  assignmentCeiling: () => ceiling,
  PLATFORM: { scope: "platform" },
}));

import { setPlatformRole, setUserActive } from "@/features/admin/actions";

function allow(...keys: string[]) {
  mockGetAccess.mockResolvedValue({ has: (key: string) => keys.includes(key) });
}

/**
 * `setPlatformRole` liest Konto und Rolle nebenläufig — beide über dieselben
 * Mocks. Die Reihenfolge der Antworten liegt damit fest.
 */
function target(opts: { rank?: number; key?: string } = {}) {
  mockUserFindUnique.mockResolvedValue({
    firstName: "Grace",
    lastName: "Hopper",
    email: "grace@example.com",
    platformRole: opts.key
      ? { key: opts.key, name: opts.key, rank: opts.rank ?? 0 }
      : null,
  });
}

beforeEach(() => {
  mock.clearAllMocks();
  ceiling = Number.POSITIVE_INFINITY;
  mockCurrentUserId.mockResolvedValue("admin1");
  mockUserUpdate.mockResolvedValue({});
  mockAuditCreate.mockResolvedValue({});
  target({ key: "platform_member", rank: 0 });
  mockRoleFindUnique.mockResolvedValue({
    key: "platform_admin",
    name: "Platform Admin",
    rank: 2,
    scope: "PLATFORM",
  });
});

describe("Plattform-Rolle setzen", () => {
  it("verlangt user.manage", async () => {
    allow("platform.access");
    const result = await setPlatformRole("u2", "pf:admin");
    expect(result).toEqual({ error: "You are not allowed to do this." });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("lehnt die eigene Zeile ab", async () => {
    allow("user.manage");
    const result = await setPlatformRole("admin1", "pf:admin");
    expect("error" in result).toBe(true);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("lehnt eine Rolle ab, die kein Plattform-Scope hat", async () => {
    allow("user.manage");
    mockRoleFindUnique.mockResolvedValue({
      key: "admin",
      name: "Admin",
      rank: 5,
      scope: "WORKSPACE",
    });

    const result = await setPlatformRole("u2", "sys:WORKSPACE:admin");
    expect("error" in result).toBe(true);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("vergibt keine Rolle über dem eigenen Rang", async () => {
    allow("user.manage");
    ceiling = 1;

    const result = await setPlatformRole("u2", "pf:admin");
    expect("error" in result).toBe(true);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("fasst niemanden an, der höher steht als man selbst", async () => {
    allow("user.manage");
    ceiling = 1;
    target({ key: "platform_admin", rank: 2 });
    mockRoleFindUnique.mockResolvedValue({
      key: "platform_member",
      name: "Platform Member",
      rank: 0,
      scope: "PLATFORM",
    });

    const result = await setPlatformRole("u2", "pf:member");
    expect("error" in result).toBe(true);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("setzt die Rolle und protokolliert alte wie neue", async () => {
    allow("user.manage");

    const result = await setPlatformRole("u2", "pf:admin");
    expect(result).toEqual({ ok: true });
    expect(mockUserUpdate).toHaveBeenCalledTimes(1);

    const entry = mockAuditCreate.mock.calls[0][0].data;
    expect(entry).toMatchObject({
      action: "user.role.platform",
      actorId: "admin1",
      targetType: "user",
      targetId: "u2",
    });
    expect(entry.meta).toEqual({
      from: "platform_member",
      to: "platform_admin",
    });
  });
});

describe("Konto stilllegen", () => {
  it("verlangt user.manage", async () => {
    allow("platform.access");
    const result = await setUserActive("u2", false);
    expect(result).toEqual({ error: "You are not allowed to do this." });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("lässt niemanden sich selbst stilllegen", async () => {
    allow("user.manage");
    const result = await setUserActive("admin1", false);
    expect("error" in result).toBe(true);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("setzt einen Zeitpunkt und protokolliert die Begründung", async () => {
    allow("user.manage");

    const result = await setUserActive("u2", false, "Austritt zum 31.08.");
    expect(result).toEqual({ ok: true });

    expect(mockUserUpdate.mock.calls[0][0].data.deactivatedAt).toBeInstanceOf(
      Date,
    );
    expect(mockAuditCreate.mock.calls[0][0].data).toMatchObject({
      action: "user.deactivated",
      reason: "Austritt zum 31.08.",
    });
  });

  it("gibt wieder frei, indem es den Zeitpunkt löscht", async () => {
    allow("user.manage");

    await setUserActive("u2", true);

    expect(mockUserUpdate.mock.calls[0][0].data.deactivatedAt).toBeNull();
    expect(mockAuditCreate.mock.calls[0][0].data).toMatchObject({
      action: "user.reactivated",
    });
  });
});
