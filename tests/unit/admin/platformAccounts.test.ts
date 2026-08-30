import { beforeEach, describe, expect, it, mock } from "bun:test";

// Role assignment and deactivation at the platform level. Both shift
// permissions, and both follow the same two rules: not on yourself, and
// not above your own rank.

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
 * `setPlatformRole` reads account and role concurrently — both through the
 * same mocks. That fixes the order in which responses must be set up.
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

describe("Setting the platform role", () => {
  it("requires user.manage", async () => {
    allow("platform.access");
    const result = await setPlatformRole("u2", "pf:admin");
    expect(result).toEqual({ error: "You are not allowed to do this." });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("rejects the user's own row", async () => {
    allow("user.manage");
    const result = await setPlatformRole("admin1", "pf:admin");
    expect("error" in result).toBe(true);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("rejects a role that doesn't have platform scope", async () => {
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

  it("doesn't grant a role above the user's own rank", async () => {
    allow("user.manage");
    ceiling = 1;

    const result = await setPlatformRole("u2", "pf:admin");
    expect("error" in result).toBe(true);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("doesn't touch anyone ranked higher than oneself", async () => {
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

  it("sets the role and logs both old and new", async () => {
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

describe("Suspending an account", () => {
  it("requires user.manage", async () => {
    allow("platform.access");
    const result = await setUserActive("u2", false);
    expect(result).toEqual({ error: "You are not allowed to do this." });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("doesn't let anyone suspend themselves", async () => {
    allow("user.manage");
    const result = await setUserActive("admin1", false);
    expect("error" in result).toBe(true);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("sets a timestamp and logs the justification", async () => {
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

  it("reinstates it by clearing the timestamp", async () => {
    allow("user.manage");

    await setUserActive("u2", true);

    expect(mockUserUpdate.mock.calls[0][0].data.deactivatedAt).toBeNull();
    expect(mockAuditCreate.mock.calls[0][0].data).toMatchObject({
      action: "user.reactivated",
    });
  });
});
