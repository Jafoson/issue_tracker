import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// `@/lib/invitations` bleibt ungemockt — seine eigenen Tests laufen im selben
// Prozess (`tests/unit/invitations/invitations.test.ts`), siehe CLAUDE.md.
// `createInvitation` läuft hier also echt, gegen den `db`-Mock.

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

  // `$transaction` reicht denselben Mock-Client durch — die Tests prüfen
  // direkt gegen die Top-Level-Mocks, kein separates `tx`-Objekt nötig.
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
  mockUserFindUnique.mockResolvedValue({ passwordHash: null });
  mockUserDelete.mockResolvedValue({});
}

describe("resendInvitation()", () => {
  beforeEach(reset);

  it("lehnt ab, wenn niemand eingeloggt ist", async () => {
    mockCurrentUserId.mockResolvedValue(null);
    expect(await resendInvitation(TOKEN)).toEqual({
      error: "You must be logged in.",
    });
  });

  it("meldet eine unbekannte oder schon angenommene Einladung", async () => {
    mockInvitationFindUnique.mockResolvedValue(null);
    expect(await resendInvitation(TOKEN)).toEqual({
      error: "This invitation no longer exists.",
    });
  });

  it("meldet eine schon angenommene Einladung", async () => {
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

  it("verlangt member.invite im Workspace", async () => {
    mockCan.mockResolvedValue(false);
    expect(await resendInvitation(TOKEN)).toEqual({
      error: "You are not allowed to manage invitations here.",
    });
  });

  it("stellt einen neuen Token aus und verschickt ihn erneut", async () => {
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

  it("lehnt ab, wenn niemand eingeloggt ist", async () => {
    mockCurrentUserId.mockResolvedValue(null);
    expect(await revokeInvitation(TOKEN)).toEqual({
      error: "You must be logged in.",
    });
  });

  it("meldet eine unbekannte oder schon angenommene Einladung", async () => {
    mockInvitationFindUnique.mockResolvedValue(null);
    expect(await revokeInvitation(TOKEN)).toEqual({
      error: "This invitation no longer exists.",
    });
  });

  it("verlangt member.invite im Workspace", async () => {
    mockCan.mockResolvedValue(false);
    expect(await revokeInvitation(TOKEN)).toEqual({
      error: "You are not allowed to manage invitations here.",
    });
    expect(mockInvitationDelete).not.toHaveBeenCalled();
  });

  it("löscht Token und Mitgliedschaften und danach das Schatten-Konto", async () => {
    // Standardlage: kein Passwort, keine übrigen Mitgliedschaften.
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

  it("lässt das Konto stehen, wenn es ein Passwort hat", async () => {
    mockUserFindUnique.mockResolvedValue({ passwordHash: "hash" });
    await revokeInvitation(TOKEN);
    expect(mockUserDelete).not.toHaveBeenCalled();
  });

  it("lässt das Konto stehen, wenn es noch anderswo Mitglied ist", async () => {
    // Z. B. mitten in einer zweiten, unabhängigen Einladung.
    mockWorkspaceMemberCount.mockResolvedValue(1);
    await revokeInvitation(TOKEN);
    expect(mockUserDelete).not.toHaveBeenCalled();
  });

  it("räumt bei einem Projekt-Gast dieselben Zeilen auf, ohne Workspace-Mitgliedschaft", async () => {
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
