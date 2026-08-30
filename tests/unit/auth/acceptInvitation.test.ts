import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockTx = {
  workspaceMember: { findUnique: mock(), update: mock() },
  project: { findMany: mock() },
  projectMember: { createMany: mock() },
  invitation: { update: mock() },
};

const mockTransaction = mock();
const mockInvitationFindUnique = mock();
// `recordAudit` (`@/lib/audit`) runs for real here against these two — mocking
// the module would leak into `tests/unit/audit/audit.test.ts`, which checks
// the real function in the same process (see CLAUDE.md).
const mockAuditLogCreate = mock();
const mockAuditUserFindUnique = mock();

mock.module("@/lib/db", () => ({
  db: {
    // `openInvitation` runs for real here — only the row comes from the mock.
    invitation: { findUnique: mockInvitationFindUnique },
    auditLog: { create: mockAuditLogCreate },
    user: { findUnique: mockAuditUserFindUnique },
    $transaction: mockTransaction,
  },
}));

const mockGetSession = mock();
mock.module("@/lib/session", () => ({ getSession: mockGetSession }));

import { acceptInvitation } from "@/features/auth/actions";

/** An open invitation, as delivered by the database. */
const VALID_ROW = {
  token: "tok",
  workspaceId: "acme",
  projectId: null,
  expires: new Date("2099-01-01"),
  acceptedAt: null,
  workspace: { name: "Acme", suspended: false },
  user: {
    id: "u-1",
    email: "ada@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    authenticators: [],
  },
};

function reset() {
  for (const group of Object.values(mockTx)) {
    for (const fn of Object.values(group)) {
      fn.mockReset();
      fn.mockResolvedValue({});
    }
  }
  // Two readers of the same row: the action queries `pending`, catching up
  // on the projects queries the role entries.
  mockTx.workspaceMember.findUnique.mockResolvedValue({
    pending: true,
    role: {
      permissions: [
        { permissionKey: "project.view" },
        { permissionKey: "issue.create" },
      ],
    },
  });
  mockTx.project.findMany.mockResolvedValue([{ id: "p-1" }]);

  mockTransaction.mockReset();
  mockTransaction.mockImplementation(
    async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
  );

  mockInvitationFindUnique.mockReset();
  mockInvitationFindUnique.mockResolvedValue(VALID_ROW);
  mockGetSession.mockReset();
  mockGetSession.mockResolvedValue({ userId: "u-1" });
  mockAuditLogCreate.mockReset();
  mockAuditLogCreate.mockResolvedValue({});
  mockAuditUserFindUnique.mockReset();
  mockAuditUserFindUnique.mockResolvedValue({
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    color: "#000000",
  });
}

describe("acceptInvitation() — access", () => {
  beforeEach(reset);

  it("requires a session", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(await acceptInvitation("tok")).toEqual({
      error: "You must be signed in to accept this invitation.",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  // Unknown, expired, used: `openInvitation` doesn't distinguish between
  // these, and neither does this message.
  it("rejects an invalid invitation", async () => {
    mockInvitationFindUnique.mockResolvedValue(null);
    expect(await acceptInvitation("tok")).toEqual({
      error: "This invitation is no longer valid. Ask for a new one.",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("rejects a logged-in session belonging to someone else", async () => {
    mockGetSession.mockResolvedValue({ userId: "u-other" });
    expect(await acceptInvitation("tok")).toEqual({
      error:
        "You're signed in with a different account. Sign out first, then open the invitation link again.",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

describe("acceptInvitation() — setting up access", () => {
  beforeEach(reset);

  it("clears pending — only then does the role's permissions take effect", async () => {
    await acceptInvitation("tok");
    expect(mockTx.workspaceMember.update).toHaveBeenCalledWith({
      where: { workspaceId_userId: { workspaceId: "acme", userId: "u-1" } },
      data: { pending: false },
    });
  });

  it("adds the person to the public projects", async () => {
    await acceptInvitation("tok");
    expect(mockTx.project.findMany.mock.calls[0][0].where.visibility).toBe(
      "public",
    );
    expect(mockTx.projectMember.createMany).toHaveBeenCalled();
  });

  it("consumes the token", async () => {
    await acceptInvitation("tok");
    const call = mockTx.invitation.update.mock.calls[0][0];
    expect(call.where).toEqual({ token: "tok" });
    expect(call.data.acceptedAt).toBeInstanceOf(Date);
  });

  it("sends them into the workspace", async () => {
    expect(await acceptInvitation("tok")).toEqual({ redirectTo: "/acme" });
  });

  it("logs the addition", async () => {
    await acceptInvitation("tok");
    const entry = mockAuditLogCreate.mock.calls[0][0].data;
    expect(entry.action).toBe("member.added");
    expect(entry.actorId).toBe("u-1");
    expect(entry.targetType).toBe("user");
    expect(entry.targetId).toBe("u-1");
    expect(entry.targetLabel).toBe("Ada Lovelace");
    expect(entry.workspaceId).toBe("acme");
  });
});

describe("acceptInvitation() — project guest", () => {
  beforeEach(reset);

  it("leaves a guest without workspace membership alone", async () => {
    // No `WorkspaceMember`: access hinges solely on the project row, which
    // is already in place. There's nothing to lift here.
    mockTx.workspaceMember.findUnique.mockResolvedValue(null);

    await acceptInvitation("tok");

    expect(mockTx.workspaceMember.update).not.toHaveBeenCalled();
    expect(mockTx.projectMember.createMany).not.toHaveBeenCalled();
    expect(mockTx.invitation.update).toHaveBeenCalled();
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });

  it("doesn't touch a membership that's already been accepted", async () => {
    mockTx.workspaceMember.findUnique.mockResolvedValue({
      pending: false,
      role: { permissions: [] },
    });
    await acceptInvitation("tok");
    expect(mockTx.workspaceMember.update).not.toHaveBeenCalled();
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });
});
