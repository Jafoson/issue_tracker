import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockWorkspaceMemberFindUnique = mock();
const mockTransaction = mock();

const mockTx = {
  workspaceMember: { delete: mock() },
};

mock.module("@/lib/db", () => ({
  db: {
    workspaceMember: { findUnique: mockWorkspaceMemberFindUnique },
    user: { findUnique: mock() },
    auditLog: { create: mock(async () => ({})) },
    $transaction: mockTransaction,
  },
}));

const mockRequirePermission = mock();
const mockAccessFor = mock();

mock.module("@/lib/permissions", () => ({
  requirePermission: mockRequirePermission,
  accessFor: mockAccessFor,
  PermissionError: class PermissionError extends Error {},
}));

// `@/lib/project-membership` wird auch von `teams.test.ts` im selben Prozess
// komplett gemockt (geteilter Modul-Cache, siehe CLAUDE.md) — hier deshalb
// selbst mocken, statt auf die echte Implementierung zu vertrauen.
const mockDropProjectMemberships = mock();

mock.module("@/lib/project-membership", () => ({
  dropProjectMemberships: mockDropProjectMemberships,
  enrollInWorkspaceProjects: mock(),
  enrollWorkspaceMembers: mock(),
  syncProjectTeamRoles: mock(),
}));

mock.module("next/cache", () => ({ revalidatePath: mock() }));

// Kein Mock für `@/lib/mail`: ohne `SMTP_HOST` (siehe tests/setup.ts) endet
// `sendMemberRemovedEmail` beim `isMailConfigured()`-Check, bevor sie die
// (hier ohnehin ungemockte) Datenbank anfasst — derselbe Weg wie bei
// `sendInvitationEmail` in den Einladungs-Tests.
import { removeMember } from "@/features/workspaces/actions";

const WS = "acme";
const ACTOR = "u-actor";

function reset() {
  for (const m of [
    mockWorkspaceMemberFindUnique,
    mockTransaction,
    mockRequirePermission,
    mockAccessFor,
    mockDropProjectMemberships,
  ]) {
    m.mockReset();
  }
  for (const group of Object.values(mockTx)) {
    for (const fn of Object.values(group)) {
      fn.mockReset();
      fn.mockResolvedValue({});
    }
  }
  mockTransaction.mockImplementation(
    async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
  );

  mockRequirePermission.mockResolvedValue(ACTOR);
  mockAccessFor.mockResolvedValue({
    rank: (scope: string) => (scope === "WORKSPACE" ? 5 : -1),
  });
  mockWorkspaceMemberFindUnique.mockResolvedValue({
    role: { key: "member", rank: 2 },
    user: { firstName: "Ada", lastName: "Lovelace" },
  });
}

describe("removeMember()", () => {
  beforeEach(reset);

  it("verlangt member.remove", async () => {
    await removeMember(WS, "u-1");
    expect(mockRequirePermission).toHaveBeenCalledWith("member.remove", {
      workspaceId: WS,
    });
  });

  it("entfernt sich nicht selbst", async () => {
    await expect(removeMember(WS, ACTOR)).rejects.toThrow();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("lehnt ab, wenn die Person nicht (mehr) Mitglied ist", async () => {
    mockWorkspaceMemberFindUnique.mockResolvedValue(null);
    await expect(removeMember(WS, "u-1")).rejects.toThrow();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("entfernt den Owner nicht", async () => {
    mockWorkspaceMemberFindUnique.mockResolvedValue({
      role: { key: "owner", rank: 10 },
    });
    await expect(removeMember(WS, "u-1")).rejects.toThrow();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("entfernt kein höher gestelltes Mitglied", async () => {
    mockAccessFor.mockResolvedValue({
      rank: (scope: string) => (scope === "WORKSPACE" ? 2 : -1),
    });
    mockWorkspaceMemberFindUnique.mockResolvedValue({
      role: { key: "admin", rank: 4 },
    });
    await expect(removeMember(WS, "u-1")).rejects.toThrow();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("löscht die Mitgliedschaft und alle Projektzuordnungen", async () => {
    await removeMember(WS, "u-1");

    expect(mockTx.workspaceMember.delete).toHaveBeenCalledWith({
      where: { workspaceId_userId: { workspaceId: WS, userId: "u-1" } },
    });
    expect(mockDropProjectMemberships).toHaveBeenCalledWith(mockTx, {
      workspaceId: WS,
      userId: "u-1",
    });
  });
});
