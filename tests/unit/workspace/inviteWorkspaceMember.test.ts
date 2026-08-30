import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUserFindUnique = mock();
const mockUserFindMany = mock();
const mockRoleFindFirst = mock();
const mockWorkspaceMemberFindUnique = mock();
const mockUserPreferencesFindMany = mock();
const mockNotificationCreateMany = mock();
const mockTransaction = mock();

const mockTx = {
  user: { create: mock() },
  workspaceMember: { create: mock(), findUnique: mock() },
  project: { findMany: mock() },
  projectMember: { createMany: mock() },
  invitation: { deleteMany: mock(), create: mock() },
};

mock.module("@/lib/db", () => ({
  db: {
    user: { findUnique: mockUserFindUnique, findMany: mockUserFindMany },
    role: { findFirst: mockRoleFindFirst },
    workspace: { findUnique: mock() },
    workspaceMember: { findUnique: mockWorkspaceMemberFindUnique },
    userPreferences: { findMany: mockUserPreferencesFindMany },
    notification: { createMany: mockNotificationCreateMany },
    auditLog: { create: mock(async () => ({})) },
    $transaction: mockTransaction,
  },
}));

const mockCan = mock();
const mockCurrentUserId = mock();
const mockAccessFor = mock();

mock.module("@/lib/permissions", () => ({
  can: mockCan,
  currentUserId: mockCurrentUserId,
  accessFor: mockAccessFor,
  requirePermission: mock(),
  PermissionError: class PermissionError extends Error {},
  // A pure function — reproduced from the original so the rank rule is
  // actually exercised by the test instead of being mocked away.
  assignmentCeiling: (
    access: {
      roleKey: (s: string) => string | null;
      rank: (s: string) => number;
    },
    scope: string,
  ) =>
    access.roleKey(scope) === null
      ? Number.POSITIVE_INFINITY
      : access.rank(scope),
}));

mock.module("@/lib/session", () => ({ getSession: mock() }));
mock.module("next/cache", () => ({ revalidatePath: mock() }));
mock.module("@/lib/user-defaults", () => ({
  generateHandle: mock(async () => "ada"),
  pickUserColor: () => "#6e63e6",
}));

// `@/lib/project-membership` is also mocked completely by `teams.test.ts` and
// `removeMember.test.ts` in the same process (shared module cache, see
// CLAUDE.md) — so it's mocked here too, instead of relying on the real
// implementation.
const mockEnrollInWorkspaceProjects = mock();
mock.module("@/lib/project-membership", () => ({
  enrollInWorkspaceProjects: mockEnrollInWorkspaceProjects,
}));

import {
  inviteWorkspaceMember,
  inviteWorkspaceMembers,
} from "@/features/workspaces/actions";

const WS = "acme";
const ACTOR = "u-actor";

/** An actor with permissions and a rank at the workspace level. */
function access(rank: number | null) {
  return {
    has: () => true,
    rank: (scope: string) => (scope === "WORKSPACE" ? (rank ?? -1) : -1),
    roleKey: (scope: string) =>
      scope === "WORKSPACE" && rank !== null ? "admin" : null,
    workspaceId: WS,
    projectId: null,
  };
}

function reset() {
  for (const m of [
    mockUserFindUnique,
    mockUserFindMany,
    mockRoleFindFirst,
    mockWorkspaceMemberFindUnique,
    mockUserPreferencesFindMany,
    mockNotificationCreateMany,
    mockTransaction,
    mockCan,
    mockCurrentUserId,
    mockAccessFor,
    mockEnrollInWorkspaceProjects,
  ]) {
    m.mockReset();
  }
  for (const group of Object.values(mockTx)) {
    for (const fn of Object.values(group)) {
      fn.mockReset();
      fn.mockResolvedValue({});
    }
  }
  mockTx.user.create.mockResolvedValue({ id: "u-new" });
  mockTx.workspaceMember.findUnique.mockResolvedValue({
    role: { permissions: [{ permissionKey: "issue.create" }] },
  });
  mockTransaction.mockImplementation(
    async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
  );

  mockCurrentUserId.mockResolvedValue(ACTOR);
  mockCan.mockResolvedValue(true);
  mockAccessFor.mockResolvedValue(access(5));
  mockRoleFindFirst.mockResolvedValue({ id: "sys:WORKSPACE:member", rank: 2 });
  mockUserFindUnique.mockResolvedValue(null);
  mockUserFindMany.mockResolvedValue([]);
  mockWorkspaceMemberFindUnique.mockResolvedValue(null);
  mockUserPreferencesFindMany.mockResolvedValue([]);
  mockNotificationCreateMany.mockResolvedValue({ count: 0 });
}

const invite = (over: Partial<{ email: string; role: string }> = {}) =>
  inviteWorkspaceMember({
    workspaceId: WS,
    email: over.email ?? "ada@example.com",
    role: over.role ?? "member",
  });

describe("inviteWorkspaceMember() — access protection", () => {
  beforeEach(reset);

  it("rejects when nobody is logged in", async () => {
    mockCurrentUserId.mockResolvedValue(null);
    expect(await invite()).toEqual({ error: "You must be logged in." });
  });

  it("requires member.invite in the workspace", async () => {
    mockCan.mockResolvedValue(false);
    expect(await invite()).toEqual({
      error: "You are not allowed to invite people to this workspace.",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("checks in the workspace context", async () => {
    await invite();
    expect(mockCan).toHaveBeenCalledWith(ACTOR, "member.invite", {
      workspaceId: WS,
    });
  });
});

describe("inviteWorkspaceMember() — role and address", () => {
  beforeEach(reset);

  it("rejects a nonsensical address", async () => {
    expect(await invite({ email: "keine-adresse" })).toEqual({
      error: "Please enter a valid email address.",
    });
  });

  it("does not hand out the owner role", async () => {
    expect(await invite({ role: "owner" })).toEqual({
      error: "The owner role cannot be handed out.",
    });
  });

  it("rejects an unknown role", async () => {
    mockRoleFindFirst.mockResolvedValue(null);
    expect(await invite({ role: "gibtsnicht" })).toEqual({
      error: "Pick a valid role.",
    });
  });

  it("does not assign a role above one's own rank", async () => {
    mockAccessFor.mockResolvedValue(access(2));
    mockRoleFindFirst.mockResolvedValue({ id: "sys:WORKSPACE:admin", rank: 5 });
    expect(await invite({ role: "admin" })).toEqual({
      error: "You cannot assign a role above your own.",
    });
  });
});

describe("inviteWorkspaceMember() — known account", () => {
  beforeEach(reset);

  it("admits it without an invitation — it can already log in", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "u-1" });

    const result = await invite();

    expect(result).toEqual({ ok: true });
    expect(mockTx.workspaceMember.create.mock.calls[0][0].data).toMatchObject({
      userId: "u-1",
      pending: false,
    });
    expect(mockTx.invitation.create).not.toHaveBeenCalled();
    // And it ends up in the public projects.
    expect(mockEnrollInWorkspaceProjects).toHaveBeenCalledWith(mockTx, {
      workspaceId: WS,
      userId: "u-1",
    });
  });

  it("notices when the person is already a member", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "u-1" });
    mockWorkspaceMemberFindUnique.mockResolvedValue({ userId: "u-1" });
    expect(await invite()).toEqual({
      error: "This person is already in the workspace.",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

describe("inviteWorkspaceMember() — unknown address", () => {
  beforeEach(reset);

  it("creates an account without a password and issues a token", async () => {
    const result = await invite();

    expect(result).toMatchObject({ ok: true });
    expect("inviteUrl" in result && result.inviteUrl).toContain("/invite/");

    const created = mockTx.user.create.mock.calls[0][0].data;
    expect(created.email).toBe("ada@example.com");
    expect(created.passwordHash).toBeUndefined();
    // First name derived from the local part, until the person sets it themselves.
    expect(created.firstName).toBe("Ada");

    expect(mockTx.workspaceMember.create.mock.calls[0][0].data.pending).toBe(
      true,
    );
    expect(mockTx.invitation.create).toHaveBeenCalled();
  });

  it("normalizes the address", async () => {
    await invite({ email: "  ADA@Example.COM " });
    expect(mockUserFindUnique.mock.calls[0][0].where.email).toBe(
      "ada@example.com",
    );
  });
});

describe("inviteWorkspaceMembers()", () => {
  beforeEach(reset);

  it("invites several addresses and returns one result per row", async () => {
    mockUserFindUnique.mockImplementation(
      async ({ where }: { where: { email: string } }) =>
        where.email === "bekannt@example.com" ? { id: "u-1" } : null,
    );

    const result = await inviteWorkspaceMembers({
      workspaceId: WS,
      emails: ["bekannt@example.com", "neu@example.com"],
      role: "member",
    });

    if ("error" in result) throw new Error("unerwarteter Fehler");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      email: "bekannt@example.com",
      result: { ok: true },
    });
    expect(result.rows[1].email).toBe("neu@example.com");
    expect(result.rows[1].result).toMatchObject({ ok: true });
    expect(
      "inviteUrl" in result.rows[1].result && result.rows[1].result.inviteUrl,
    ).toContain("/invite/");
  });

  it("reports an invalid address only for that row, not for the whole call", async () => {
    const result = await inviteWorkspaceMembers({
      workspaceId: WS,
      emails: ["keine-adresse", "gut@example.com"],
      role: "member",
    });

    if ("error" in result) throw new Error("unerwarteter Fehler");
    expect(result.rows[0].result).toEqual({
      error: "Please enter a valid email address.",
    });
    expect(result.rows[1].result).toMatchObject({ ok: true });
  });

  it("deduplicates addresses", async () => {
    const result = await inviteWorkspaceMembers({
      workspaceId: WS,
      emails: ["ada@example.com", "ADA@example.com "],
      role: "member",
    });

    if ("error" in result) throw new Error("unerwarteter Fehler");
    expect(result.rows).toHaveLength(1);
  });

  it("rejects when no address is passed", async () => {
    expect(
      await inviteWorkspaceMembers({
        workspaceId: WS,
        emails: [],
        role: "member",
      }),
    ).toEqual({ error: "Add at least one email address." });
  });

  it("caps the number per call", async () => {
    const emails = Array.from(
      { length: 51 },
      (_, i) => `person${i}@example.com`,
    );
    expect(
      await inviteWorkspaceMembers({ workspaceId: WS, emails, role: "member" }),
    ).toEqual({ error: "You can invite at most 50 people at once." });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("checks role and permission only once, not per address", async () => {
    await inviteWorkspaceMembers({
      workspaceId: WS,
      emails: ["a@example.com", "b@example.com", "c@example.com"],
      role: "member",
    });

    expect(mockCan).toHaveBeenCalledTimes(1);
    expect(mockRoleFindFirst).toHaveBeenCalledTimes(1);
  });
});
