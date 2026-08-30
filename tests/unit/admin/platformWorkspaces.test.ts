import { beforeEach, describe, expect, it, mock } from "bun:test";

// Suspending and deleting a tenant.
//
// The one rule this file mainly pins down: **only what's already suspended
// gets deleted.** It lives in the server, not just in the dialog — a
// confirmation in the browser is a request, not a condition.

const mockWorkspaceFindUnique = mock();
const mockWorkspaceUpdate = mock();
const mockWorkspaceDelete = mock();
const mockIssueDeleteMany = mock();
const mockIssueCount = mock();
const mockAuditCreate = mock();
const mockUserFindUnique = mock();

const client = {
  workspace: {
    findUnique: mockWorkspaceFindUnique,
    update: mockWorkspaceUpdate,
    delete: mockWorkspaceDelete,
  },
  issue: { deleteMany: mockIssueDeleteMany, count: mockIssueCount },
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

import {
  deleteWorkspaceAsPlatform,
  setWorkspaceSuspended,
} from "@/features/admin/actions";

function allow(...keys: string[]) {
  mockGetAccess.mockResolvedValue({ has: (key: string) => keys.includes(key) });
}

/** The tenant that the test cases refer to. */
function workspace(opts: { suspended?: boolean } = {}) {
  mockWorkspaceFindUnique.mockResolvedValue({
    name: "Nimbus",
    suspended: opts.suspended ?? false,
    _count: { members: 7, projects: 3 },
  });
}

beforeEach(() => {
  mock.clearAllMocks();
  mockCurrentUserId.mockResolvedValue("admin1");
  mockUserFindUnique.mockResolvedValue({
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
  });
  mockWorkspaceUpdate.mockResolvedValue({});
  mockWorkspaceDelete.mockResolvedValue({});
  mockIssueDeleteMany.mockResolvedValue({ count: 0 });
  mockIssueCount.mockResolvedValue(24);
  mockAuditCreate.mockResolvedValue({});
  workspace();
});

describe("Suspending", () => {
  it("requires workspace.suspend", async () => {
    allow("platform.access", "user.manage");

    const result = await setWorkspaceSuspended("nimbus", true);

    expect(result).toEqual({ error: "You are not allowed to do this." });
    expect(mockWorkspaceUpdate).not.toHaveBeenCalled();
  });

  it("sets the flag and logs who it affects", async () => {
    allow("workspace.suspend");

    const result = await setWorkspaceSuspended(
      "nimbus",
      true,
      "Rechnung offen",
    );

    expect(result).toEqual({ ok: true });
    expect(mockWorkspaceUpdate.mock.calls[0][0].data).toEqual({
      suspended: true,
    });

    const entry = mockAuditCreate.mock.calls[0][0].data;
    expect(entry).toMatchObject({
      action: "workspace.suspended",
      targetLabel: "Nimbus",
      reason: "Rechnung offen",
    });
    expect(entry.meta).toEqual({ members: 7 });
  });

  it("releases it again through the same path", async () => {
    allow("workspace.suspend");
    workspace({ suspended: true });

    await setWorkspaceSuspended("nimbus", false);

    expect(mockWorkspaceUpdate.mock.calls[0][0].data).toEqual({
      suspended: false,
    });
    expect(mockAuditCreate.mock.calls[0][0].data).toMatchObject({
      action: "workspace.unsuspended",
    });
  });
});

describe("Deleting", () => {
  it("requires workspace.delete", async () => {
    allow("workspace.suspend");
    workspace({ suspended: true });

    const result = await deleteWorkspaceAsPlatform("nimbus", "Nimbus");

    expect(result).toEqual({ error: "You are not allowed to do this." });
    expect(mockWorkspaceDelete).not.toHaveBeenCalled();
  });

  it("refuses as long as the tenant is active", async () => {
    // The actual safeguard: suspend first, then delete. A deliberate second
    // action lies between the two steps.
    allow("workspace.delete");
    workspace({ suspended: false });

    const result = await deleteWorkspaceAsPlatform("nimbus", "Nimbus");

    expect(result).toEqual({
      error: "Suspend this workspace before deleting it.",
    });
    expect(mockWorkspaceDelete).not.toHaveBeenCalled();
    expect(mockIssueDeleteMany).not.toHaveBeenCalled();
  });

  it("refuses when the name is typed incorrectly", async () => {
    allow("workspace.delete");
    workspace({ suspended: true });

    const result = await deleteWorkspaceAsPlatform("nimbus", "nimbus");

    expect(result).toEqual({ error: "The name does not match." });
    expect(mockWorkspaceDelete).not.toHaveBeenCalled();
  });

  it("deletes the issues before the workspace", async () => {
    // `Issue.projectId` is set to `Restrict` — the other way round, the
    // project couldn't be deleted at all.
    allow("workspace.delete");
    workspace({ suspended: true });

    const result = await deleteWorkspaceAsPlatform("nimbus", "  Nimbus  ");

    expect(result).toEqual({ ok: true });
    expect(mockIssueDeleteMany).toHaveBeenCalled();
    expect(mockWorkspaceDelete).toHaveBeenCalled();
    expect(mockIssueDeleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      mockWorkspaceDelete.mock.invocationCallOrder[0],
    );
  });

  it("records in the log what was lost", async () => {
    allow("workspace.delete");
    workspace({ suspended: true });

    await deleteWorkspaceAsPlatform("nimbus", "Nimbus");

    const entry = mockAuditCreate.mock.calls[0][0].data;
    expect(entry).toMatchObject({
      action: "workspace.deleted",
      targetLabel: "Nimbus",
    });
    // The numbers are read before deletion — afterward there'd be nothing
    // left to count, and the entry would be an empty claim.
    expect(entry.meta).toEqual({
      members: 7,
      projects: 3,
      issues: 24,
      from: "platform",
    });
  });
});
