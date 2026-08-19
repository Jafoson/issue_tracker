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
// `recordAudit` (`@/lib/audit`) läuft hier echt gegen diese beiden — ein Mock
// des Moduls würde in `tests/unit/audit/audit.test.ts` lecken, das im selben
// Prozess die echte Funktion prüft (siehe CLAUDE.md).
const mockAuditLogCreate = mock();
const mockAuditUserFindUnique = mock();

mock.module("@/lib/db", () => ({
  db: {
    // `openInvitation` läuft hier echt — nur die Zeile kommt aus dem Mock.
    invitation: { findUnique: mockInvitationFindUnique },
    auditLog: { create: mockAuditLogCreate },
    user: { findUnique: mockAuditUserFindUnique },
    $transaction: mockTransaction,
  },
}));

const mockGetSession = mock();
mock.module("@/lib/session", () => ({ getSession: mockGetSession }));

import { acceptInvitation } from "@/features/auth/actions";

/** Eine offene Einladung, wie die Datenbank sie liefert. */
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
  // Zwei Leser derselben Zeile: die Action fragt `pending`, das Nachziehen der
  // Projekte fragt die Rollen-Einträge.
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

describe("acceptInvitation() — Zugriff", () => {
  beforeEach(reset);

  it("verlangt eine Session", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(await acceptInvitation("tok")).toEqual({
      error: "You must be signed in to accept this invitation.",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  // Unbekannt, abgelaufen, benutzt: `openInvitation` unterscheidet das nicht, und
  // diese Meldung tut es auch nicht.
  it("lehnt eine ungültige Einladung ab", async () => {
    mockInvitationFindUnique.mockResolvedValue(null);
    expect(await acceptInvitation("tok")).toEqual({
      error: "This invitation is no longer valid. Ask for a new one.",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("lehnt eine fremde, eingeloggte Sitzung ab", async () => {
    mockGetSession.mockResolvedValue({ userId: "u-other" });
    expect(await acceptInvitation("tok")).toEqual({
      error:
        "You're signed in with a different account. Sign out first, then open the invitation link again.",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

describe("acceptInvitation() — Zugang einrichten", () => {
  beforeEach(reset);

  it("hebt pending auf — erst damit greifen die Rechte der Rolle", async () => {
    await acceptInvitation("tok");
    expect(mockTx.workspaceMember.update).toHaveBeenCalledWith({
      where: { workspaceId_userId: { workspaceId: "acme", userId: "u-1" } },
      data: { pending: false },
    });
  });

  it("nimmt die Person in die öffentlichen Projekte auf", async () => {
    await acceptInvitation("tok");
    expect(mockTx.project.findMany.mock.calls[0][0].where.visibility).toBe(
      "public",
    );
    expect(mockTx.projectMember.createMany).toHaveBeenCalled();
  });

  it("verbraucht den Token", async () => {
    await acceptInvitation("tok");
    const call = mockTx.invitation.update.mock.calls[0][0];
    expect(call.where).toEqual({ token: "tok" });
    expect(call.data.acceptedAt).toBeInstanceOf(Date);
  });

  it("schickt in den Workspace", async () => {
    expect(await acceptInvitation("tok")).toEqual({ redirectTo: "/acme" });
  });

  it("protokolliert die Aufnahme", async () => {
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

describe("acceptInvitation() — Projekt-Gast", () => {
  beforeEach(reset);

  it("lässt einen Gast ohne Workspace-Mitgliedschaft in Ruhe", async () => {
    // Kein `WorkspaceMember`: der Zugriff hängt allein an der Projektzeile, die
    // schon steht. Zu heben gibt es hier nichts.
    mockTx.workspaceMember.findUnique.mockResolvedValue(null);

    await acceptInvitation("tok");

    expect(mockTx.workspaceMember.update).not.toHaveBeenCalled();
    expect(mockTx.projectMember.createMany).not.toHaveBeenCalled();
    expect(mockTx.invitation.update).toHaveBeenCalled();
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });

  it("rührt eine schon angenommene Mitgliedschaft nicht an", async () => {
    mockTx.workspaceMember.findUnique.mockResolvedValue({
      pending: false,
      role: { permissions: [] },
    });
    await acceptInvitation("tok");
    expect(mockTx.workspaceMember.update).not.toHaveBeenCalled();
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });
});
