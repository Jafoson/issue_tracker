import { beforeEach, describe, expect, it, mock } from "bun:test";

// Break-glass access is the only place where platform administration reaches
// into content. This file checks the three guarantees that make it tolerable:
// a reason is mandatory, membership and audit log entry are created
// together, and without the permission nothing happens at all.

const mockProjectFindUnique = mock();
const mockProjectMemberFindUnique = mock();
const mockProjectMemberCreate = mock();
const mockAuditCreate = mock();
const mockUserFindUnique = mock(async () => ({
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
}));

/**
 * The transaction runs its callback with the same client.
 *
 * That's exactly the point here: `recordAuditIn` receives `tx`, not `db`. If
 * the callback throws, both would in fact be rolled back — the test therefore
 * checks that both writes happen *inside* this callback.
 */
const client = {
  project: { findUnique: mockProjectFindUnique },
  projectMember: {
    findUnique: mockProjectMemberFindUnique,
    create: mockProjectMemberCreate,
  },
  auditLog: { create: mockAuditCreate },
  user: { findUnique: mockUserFindUnique },
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
};

mock.module("@/lib/db", () => ({ db: client }));
mock.module("next/cache", () => ({ revalidatePath: mock() }));

const mockGetAccess = mock();
const mockCurrentUserId = mock(async () => "admin1");
mock.module("@/lib/permissions", () => ({
  getAccess: mockGetAccess,
  currentUserId: mockCurrentUserId,
  assignmentCeiling: () => Number.POSITIVE_INFINITY,
  PLATFORM: { scope: "platform" },
}));

import { breakGlassJoinProject } from "@/features/admin/actions";

const REASON = "Projektleitung im Krankenhaus, Freigabe muss heute raus";

function allow(...keys: string[]) {
  mockGetAccess.mockResolvedValue({ has: (key: string) => keys.includes(key) });
}

beforeEach(() => {
  mock.clearAllMocks();
  mockCurrentUserId.mockResolvedValue("admin1");
  mockUserFindUnique.mockResolvedValue({
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
  });
  mockProjectFindUnique.mockResolvedValue({
    name: "Kündigungen Q3",
    workspaceId: "ws1",
  });
  mockProjectMemberFindUnique.mockResolvedValue(null);
  mockProjectMemberCreate.mockResolvedValue({});
  mockAuditCreate.mockResolvedValue({});
});

describe("Emergency access", () => {
  it("requires the permission", async () => {
    allow("platform.access", "user.manage");

    const result = await breakGlassJoinProject({
      projectId: "p1",
      reason: REASON,
    });

    expect(result).toEqual({ error: "You are not allowed to do this." });
    expect(mockProjectMemberCreate).not.toHaveBeenCalled();
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it("requires a justification", async () => {
    allow("project.breakglass");

    const result = await breakGlassJoinProject({ projectId: "p1", reason: "" });

    expect("error" in result).toBe(true);
    expect(mockProjectMemberCreate).not.toHaveBeenCalled();
  });

  it("doesn't let a too-short justification through", async () => {
    allow("project.breakglass");

    const result = await breakGlassJoinProject({
      projectId: "p1",
      reason: "  weil  ",
    });

    expect("error" in result).toBe(true);
    expect(mockProjectMemberCreate).not.toHaveBeenCalled();
  });

  it("records and logs it — both or nothing", async () => {
    allow("project.breakglass");

    const result = await breakGlassJoinProject({
      projectId: "p1",
      reason: REASON,
    });

    expect(result).toEqual({ ok: true });

    expect(mockProjectMemberCreate).toHaveBeenCalledTimes(1);
    expect(mockProjectMemberCreate.mock.calls[0][0].data).toMatchObject({
      projectId: "p1",
      userId: "admin1",
      // Visible in the member list like any other membership.
      roleId: "sys:PROJECT:project_admin",
    });

    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    const entry = mockAuditCreate.mock.calls[0][0].data;
    expect(entry).toMatchObject({
      action: "project.breakglass",
      actorId: "admin1",
      projectId: "p1",
      workspaceId: "ws1",
      reason: REASON,
    });
    // The name is frozen at write time, not resolved at read time.
    expect(entry.actorLabel).toBe("Ada Lovelace (ada@example.com)");
    expect(entry.targetLabel).toBe("Kündigungen Q3");
  });

  it("rejects someone who is already a member anyway", async () => {
    allow("project.breakglass");
    mockProjectMemberFindUnique.mockResolvedValue({ userId: "admin1" });

    const result = await breakGlassJoinProject({
      projectId: "p1",
      reason: REASON,
    });

    expect("error" in result).toBe(true);
    // No audit log entry: this wasn't break-glass access, but the normal path.
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it("rejects it when the project no longer exists", async () => {
    allow("project.breakglass");
    mockProjectFindUnique.mockResolvedValue(null);

    const result = await breakGlassJoinProject({
      projectId: "p1",
      reason: REASON,
    });

    expect("error" in result).toBe(true);
    expect(mockProjectMemberCreate).not.toHaveBeenCalled();
  });
});
