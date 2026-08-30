import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// `@/lib/invitations` stays unmocked — its own tests run in the same
// process (`tests/unit/invitations/invitations.test.ts`), see CLAUDE.md.
// So `createInvitation` runs for real here, against the `db` mock.

const mockInvitationFindUnique = mock();
const mockInvitationFindMany = mock();
const mockInvitationDelete = mock();
const mockInvitationDeleteMany = mock();
const mockInvitationCreate = mock();
const mockWorkspaceMemberFindUnique = mock();
const mockWorkspaceMemberDeleteMany = mock();
const mockWorkspaceMemberCount = mock();
const mockProjectMemberFindUnique = mock();
const mockProjectMemberDeleteMany = mock();
const mockProjectMemberCount = mock();
const mockUserFindUnique = mock();
const mockUserDelete = mock();
const mockTransaction = mock();

const dbMock = {
  invitation: {
    findUnique: mockInvitationFindUnique,
    findMany: mockInvitationFindMany,
    delete: mockInvitationDelete,
    deleteMany: mockInvitationDeleteMany,
    create: mockInvitationCreate,
  },
  workspaceMember: {
    findUnique: mockWorkspaceMemberFindUnique,
    deleteMany: mockWorkspaceMemberDeleteMany,
    count: mockWorkspaceMemberCount,
  },
  projectMember: {
    findUnique: mockProjectMemberFindUnique,
    deleteMany: mockProjectMemberDeleteMany,
    count: mockProjectMemberCount,
  },
  user: { findUnique: mockUserFindUnique, delete: mockUserDelete },
  $transaction: mockTransaction,
};

mock.module("@/lib/db", () => ({ db: dbMock }));

const mockCan = mock();
const mockCurrentUserId = mock();

mock.module("@/lib/permissions", () => ({
  can: mockCan,
  currentUserId: mockCurrentUserId,
  accessFor: mock(),
  requirePermission: mock(),
  PermissionError: class PermissionError extends Error {},
  assignmentCeiling: () => Number.POSITIVE_INFINITY,
}));

mock.module("@/lib/session", () => ({ getSession: mock() }));
mock.module("next/cache", () => ({ revalidatePath: mock() }));

import {
  resendInvitation,
  revokeInvitation,
} from "@/features/workspaces/actions";

const WS = "acme";
const ACTOR = "u-actor";
const INVITEE = "u-invitee";
const TOKEN = "tok-123";

function reset() {
  for (const m of [
    mockInvitationFindUnique,
    mockInvitationFindMany,
    mockInvitationDelete,
    mockInvitationDeleteMany,
    mockInvitationCreate,
    mockWorkspaceMemberFindUnique,
    mockWorkspaceMemberDeleteMany,
    mockWorkspaceMemberCount,
    mockProjectMemberFindUnique,
    mockProjectMemberDeleteMany,
    mockProjectMemberCount,
    mockUserFindUnique,
    mockUserDelete,
    mockTransaction,
    mockCan,
    mockCurrentUserId,
  ]) {
    m.mockReset();
  }

  // `$transaction` passes through the same mock client — the tests assert
  // directly against the top-level mocks, no separate `tx` object needed.
  mockTransaction.mockImplementation(
    async (fn: (tx: typeof dbMock) => Promise<unknown>) => fn(dbMock),
  );

  mockCurrentUserId.mockResolvedValue(ACTOR);
  mockCan.mockResolvedValue(true);
  mockInvitationFindUnique.mockResolvedValue({
    workspaceId: WS,
    projectId: null,
    userId: INVITEE,
    acceptedAt: null,
    user: { email: "invitee@example.com" },
  });
  mockWorkspaceMemberFindUnique.mockResolvedValue({
    role: { name: "Mitglied" },
  });
  mockInvitationDeleteMany.mockResolvedValue({ count: 0 });
  mockInvitationCreate.mockResolvedValue({});
  mockInvitationDelete.mockResolvedValue({});
  mockWorkspaceMemberDeleteMany.mockResolvedValue({ count: 1 });
  mockProjectMemberDeleteMany.mockResolvedValue({ count: 0 });
  mockWorkspaceMemberCount.mockResolvedValue(0);
  mockProjectMemberCount.mockResolvedValue(0);
  mockUserFindUnique.mockResolvedValue({
    _count: { authenticators: 0, accounts: 0 },
  });
  mockUserDelete.mockResolvedValue({});
}

describe("resendInvitation()", () => {
  beforeEach(reset);

  it("rejects when nobody is logged in", async () => {
    mockCurrentUserId.mockResolvedValue(null);
    expect(await resendInvitation(TOKEN)).toEqual({
      error: "You must be logged in.",
    });
  });

  it("reports an unknown or already accepted invitation", async () => {
    mockInvitationFindUnique.mockResolvedValue(null);
    expect(await resendInvitation(TOKEN)).toEqual({
      error: "This invitation no longer exists.",
    });
  });

  it("reports an already accepted invitation", async () => {
    mockInvitationFindUnique.mockResolvedValue({
      workspaceId: WS,
      projectId: null,
      userId: INVITEE,
      acceptedAt: new Date(),
      user: { email: "invitee@example.com" },
    });
    expect(await resendInvitation(TOKEN)).toEqual({
      error: "This invitation no longer exists.",
    });
  });

  it("requires member.invite in the workspace", async () => {
    mockCan.mockResolvedValue(false);
    expect(await resendInvitation(TOKEN)).toEqual({
      error: "You are not allowed to manage invitations here.",
    });
  });

  it("issues a new token and resends it", async () => {
    const result = await resendInvitation(TOKEN);

    expect(result).toMatchObject({ ok: true });
    expect("inviteUrl" in result && result.inviteUrl).toContain("/invite/");
    expect(mockInvitationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: INVITEE,
          workspaceId: WS,
          invitedById: ACTOR,
        }),
      }),
    );
  });
});

describe("revokeInvitation()", () => {
  beforeEach(reset);

  it("rejects when nobody is logged in", async () => {
    mockCurrentUserId.mockResolvedValue(null);
    expect(await revokeInvitation(TOKEN)).toEqual({
      error: "You must be logged in.",
    });
  });

  it("reports an unknown or already accepted invitation", async () => {
    mockInvitationFindUnique.mockResolvedValue(null);
    expect(await revokeInvitation(TOKEN)).toEqual({
      error: "This invitation no longer exists.",
    });
  });

  it("requires member.invite in the workspace", async () => {
    mockCan.mockResolvedValue(false);
    expect(await revokeInvitation(TOKEN)).toEqual({
      error: "You are not allowed to manage invitations here.",
    });
    expect(mockInvitationDelete).not.toHaveBeenCalled();
  });

  it("deletes the token and memberships and then the shadow account", async () => {
    // Default situation: no password, no remaining memberships.
    const result = await revokeInvitation(TOKEN);

    expect(result).toEqual({ ok: true });
    expect(mockInvitationDelete).toHaveBeenCalledWith({
      where: { token: TOKEN },
    });
    expect(mockWorkspaceMemberDeleteMany).toHaveBeenCalledWith({
      where: { workspaceId: WS, userId: INVITEE },
    });
    expect(mockProjectMemberDeleteMany).toHaveBeenCalledWith({
      where: { userId: INVITEE, project: { workspaceId: WS } },
    });
    expect(mockUserDelete).toHaveBeenCalledWith({ where: { id: INVITEE } });
  });

  it("leaves the account in place when it has a passkey", async () => {
    mockUserFindUnique.mockResolvedValue({
      _count: { authenticators: 1, accounts: 0 },
    });
    await revokeInvitation(TOKEN);
    expect(mockUserDelete).not.toHaveBeenCalled();
  });

  it("leaves the account in place when it has a connected provider", async () => {
    mockUserFindUnique.mockResolvedValue({
      _count: { authenticators: 0, accounts: 1 },
    });
    await revokeInvitation(TOKEN);
    expect(mockUserDelete).not.toHaveBeenCalled();
  });

  it("leaves the account in place when it is still a member elsewhere", async () => {
    // E.g. in the middle of a second, independent invitation.
    mockWorkspaceMemberCount.mockResolvedValue(1);
    await revokeInvitation(TOKEN);
    expect(mockUserDelete).not.toHaveBeenCalled();
  });

  it("cleans up the same rows for a project guest, without a workspace membership", async () => {
    mockInvitationFindUnique.mockResolvedValue({
      workspaceId: WS,
      projectId: "p-1",
      userId: INVITEE,
      acceptedAt: null,
      user: { email: "gast@example.com" },
    });
    mockWorkspaceMemberDeleteMany.mockResolvedValue({ count: 0 });

    const result = await revokeInvitation(TOKEN);

    expect(result).toEqual({ ok: true });
    expect(mockWorkspaceMemberDeleteMany).toHaveBeenCalledWith({
      where: { workspaceId: WS, userId: INVITEE },
    });
    expect(mockProjectMemberDeleteMany).toHaveBeenCalledWith({
      where: { userId: INVITEE, project: { workspaceId: WS } },
    });
    expect(mockUserDelete).toHaveBeenCalled();
  });
});
