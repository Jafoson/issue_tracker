import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// `@/lib/invite-links` bleibt ungemockt (keine eigenen Tests im Prozess).
// `@/lib/project-membership` wird dagegen — wie `inviteWorkspaceMember.test.ts`,
// `teams.test.ts` und `removeMember.test.ts` im selben Verzeichnis — selbst
// gemockt: der geteilte Modul-Cache (siehe CLAUDE.md) lässt ohnehin nur eine
// Fassung pro Prozess gewinnen, und dieses Verzeichnis hat sich auf den Mock
// festgelegt.

const mockRoleFindFirst = mock();
const mockInviteLinkUpdateMany = mock();
const mockInviteLinkCreate = mock();
const mockInviteLinkFindUnique = mock();
const mockInviteLinkUpdate = mock();
const mockTransaction = mock();

// Der Tx-Client für `joinViaInviteLink` — `redeemInviteLink` schreibt hierauf.
const mockTxProjectMemberUpsert = mock();
const mockTxWorkspaceMemberFindUnique = mock();
const mockTxWorkspaceMemberCreate = mock();

const mockTx = {
  projectMember: { upsert: mockTxProjectMemberUpsert },
  workspaceMember: {
    findUnique: mockTxWorkspaceMemberFindUnique,
    create: mockTxWorkspaceMemberCreate,
  },
};

mock.module("@/lib/db", () => ({
  db: {
    role: { findFirst: mockRoleFindFirst },
    inviteLink: {
      updateMany: mockInviteLinkUpdateMany,
      create: mockInviteLinkCreate,
      findUnique: mockInviteLinkFindUnique,
      update: mockInviteLinkUpdate,
    },
    $transaction: mockTransaction,
  },
}));

const mockEnrollInWorkspaceProjects = mock();
mock.module("@/lib/project-membership", () => ({
  enrollInWorkspaceProjects: mockEnrollInWorkspaceProjects,
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

import {
  createWorkspaceInviteLink,
  joinViaInviteLink,
  revokeInviteLink,
} from "@/features/workspaces/actions";

const WS = "acme";
const ACTOR = "u-actor";
const TOKEN = "tok-123";

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
    mockRoleFindFirst,
    mockInviteLinkUpdateMany,
    mockInviteLinkCreate,
    mockInviteLinkFindUnique,
    mockInviteLinkUpdate,
    mockTransaction,
    mockTxProjectMemberUpsert,
    mockTxWorkspaceMemberFindUnique,
    mockTxWorkspaceMemberCreate,
    mockEnrollInWorkspaceProjects,
    mockCan,
    mockCurrentUserId,
    mockAccessFor,
  ]) {
    m.mockReset();
  }

  mockCurrentUserId.mockResolvedValue(ACTOR);
  mockCan.mockResolvedValue(true);
  mockAccessFor.mockResolvedValue(access(5));
  mockRoleFindFirst.mockResolvedValue({ id: "sys:WORKSPACE:member", rank: 2 });
  mockInviteLinkUpdateMany.mockResolvedValue({ count: 0 });
  mockInviteLinkCreate.mockResolvedValue({});
  mockInviteLinkUpdate.mockResolvedValue({});
  mockTxWorkspaceMemberFindUnique.mockResolvedValue(null);
  mockTxWorkspaceMemberCreate.mockResolvedValue({});
  mockEnrollInWorkspaceProjects.mockResolvedValue(undefined);
  mockTransaction.mockImplementation(
    async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
  );
}

describe("createWorkspaceInviteLink()", () => {
  beforeEach(reset);

  it("lehnt ab, wenn niemand eingeloggt ist", async () => {
    mockCurrentUserId.mockResolvedValue(null);
    expect(await createWorkspaceInviteLink(WS, "member")).toEqual({
      error: "You must be logged in.",
    });
  });

  it("verlangt member.invite im Workspace", async () => {
    mockCan.mockResolvedValue(false);
    expect(await createWorkspaceInviteLink(WS, "member")).toEqual({
      error: "You are not allowed to invite people to this workspace.",
    });
  });

  it("vergibt die Owner-Rolle nicht", async () => {
    expect(await createWorkspaceInviteLink(WS, "owner")).toEqual({
      error: "The owner role cannot be handed out.",
    });
  });

  it("vergibt keine Rolle über dem eigenen Rang", async () => {
    mockAccessFor.mockResolvedValue(access(2));
    mockRoleFindFirst.mockResolvedValue({ id: "sys:WORKSPACE:admin", rank: 5 });
    expect(await createWorkspaceInviteLink(WS, "admin")).toEqual({
      error: "You cannot assign a role above your own.",
    });
  });

  it("erzeugt einen Link und widerruft einen vorherigen für denselben Scope", async () => {
    const result = await createWorkspaceInviteLink(WS, "member");

    expect(result).toMatchObject({ ok: true });
    expect("url" in result && result.url).toContain("/join/");
    expect(mockInviteLinkUpdateMany).toHaveBeenCalledWith({
      where: {
        workspaceId: WS,
        projectId: null,
        roleId: "sys:WORKSPACE:member",
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mockInviteLinkCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: WS,
        projectId: null,
        roleId: "sys:WORKSPACE:member",
        createdById: ACTOR,
        expiresAt: null,
      }),
    });
  });

  it("trägt eine Ablauffrist ein, wenn übergeben", async () => {
    const expiresAt = new Date("2030-01-01");
    const result = await createWorkspaceInviteLink(WS, "member", expiresAt);
    expect(result).toMatchObject({ ok: true, expiresAt });
  });
});

describe("revokeInviteLink()", () => {
  beforeEach(reset);

  it("lehnt ab, wenn niemand eingeloggt ist", async () => {
    mockCurrentUserId.mockResolvedValue(null);
    expect(await revokeInviteLink(TOKEN)).toEqual({
      error: "You must be logged in.",
    });
  });

  it("meldet einen unbekannten Link", async () => {
    mockInviteLinkFindUnique.mockResolvedValue(null);
    expect(await revokeInviteLink(TOKEN)).toEqual({
      error: "This link no longer exists.",
    });
  });

  it("verlangt member.invite im Workspace für einen Workspace-Link", async () => {
    mockInviteLinkFindUnique.mockResolvedValue({
      workspaceId: WS,
      projectId: null,
    });
    mockCan.mockResolvedValue(false);
    expect(await revokeInviteLink(TOKEN)).toEqual({
      error: "You are not allowed to manage this link.",
    });
    expect(mockInviteLinkUpdate).not.toHaveBeenCalled();
  });

  it("verlangt member.invite im Projekt für einen Projekt-Link", async () => {
    mockInviteLinkFindUnique.mockResolvedValue({
      workspaceId: WS,
      projectId: "p-1",
    });
    await revokeInviteLink(TOKEN);
    expect(mockCan).toHaveBeenCalledWith(ACTOR, "member.invite", {
      projectId: "p-1",
    });
  });

  it("setzt revokedAt", async () => {
    mockInviteLinkFindUnique.mockResolvedValue({
      workspaceId: WS,
      projectId: null,
    });
    expect(await revokeInviteLink(TOKEN)).toEqual({ ok: true });
    expect(mockInviteLinkUpdate).toHaveBeenCalledWith({
      where: { token: TOKEN },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

describe("joinViaInviteLink()", () => {
  beforeEach(reset);

  const validLink = {
    token: TOKEN,
    workspaceId: WS,
    projectId: null,
    roleId: "r-member",
    expiresAt: null,
    revokedAt: null,
    workspace: { name: "Acme", suspended: false },
    project: null,
    role: { key: "member", name: "Member" },
  };

  it("lehnt ab, wenn niemand eingeloggt ist", async () => {
    mockCurrentUserId.mockResolvedValue(null);
    expect(await joinViaInviteLink(TOKEN)).toEqual({
      error: "You must be logged in.",
    });
  });

  it("meldet einen ungültigen Link", async () => {
    mockInviteLinkFindUnique.mockResolvedValue(null);
    expect(await joinViaInviteLink(TOKEN)).toEqual({
      error: "This invite link is no longer valid. Ask for a new one.",
    });
  });

  it("meldet einen widerrufenen Link", async () => {
    mockInviteLinkFindUnique.mockResolvedValue({
      ...validLink,
      revokedAt: new Date(),
    });
    expect(await joinViaInviteLink(TOKEN)).toEqual({
      error: "This invite link is no longer valid. Ask for a new one.",
    });
  });

  it("meldet einen abgelaufenen Link", async () => {
    mockInviteLinkFindUnique.mockResolvedValue({
      ...validLink,
      expiresAt: new Date("2000-01-01"),
    });
    expect(await joinViaInviteLink(TOKEN)).toEqual({
      error: "This invite link is no longer valid. Ask for a new one.",
    });
  });

  it("tritt als neues Mitglied bei und wird in öffentliche Projekte aufgenommen", async () => {
    mockInviteLinkFindUnique.mockResolvedValue(validLink);

    const result = await joinViaInviteLink(TOKEN);

    expect(result).toEqual({ ok: true, workspaceId: WS });
    expect(mockTxWorkspaceMemberCreate).toHaveBeenCalledWith({
      data: {
        workspaceId: WS,
        userId: ACTOR,
        roleId: "r-member",
        pending: false,
      },
    });
    expect(mockEnrollInWorkspaceProjects).toHaveBeenCalledWith(mockTx, {
      workspaceId: WS,
      userId: ACTOR,
    });
  });

  it("ist idempotent — schon Mitglied bleibt unangetastet", async () => {
    mockInviteLinkFindUnique.mockResolvedValue(validLink);
    mockTxWorkspaceMemberFindUnique.mockResolvedValue({ userId: ACTOR });

    const result = await joinViaInviteLink(TOKEN);

    expect(result).toEqual({ ok: true, workspaceId: WS });
    expect(mockTxWorkspaceMemberCreate).not.toHaveBeenCalled();
  });
});
