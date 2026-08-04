import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUserFindUnique = mock();
const mockRoleFindFirst = mock();
const mockWorkspaceMemberFindUnique = mock();
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
    user: { findUnique: mockUserFindUnique },
    role: { findFirst: mockRoleFindFirst },
    workspace: { findUnique: mock() },
    workspaceMember: { findUnique: mockWorkspaceMemberFindUnique },
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
  // Reine Funktion — im Original nachgebildet, damit die Rangregel mitgetestet
  // wird und nicht weggemockt ist.
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

import { inviteWorkspaceMember } from "@/features/workspaces/actions";

const WS = "acme";
const ACTOR = "u-actor";

/** Ein Handelnder mit Rechten und einem Rang auf der Workspace-Ebene. */
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
    mockRoleFindFirst,
    mockWorkspaceMemberFindUnique,
    mockTransaction,
    mockCan,
    mockCurrentUserId,
    mockAccessFor,
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
    role: { permissions: [{ permissionKey: "issue.create", effect: "ALLOW" }] },
  });
  mockTx.project.findMany.mockResolvedValue([{ id: "p-1" }]);
  mockTransaction.mockImplementation(
    async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
  );

  mockCurrentUserId.mockResolvedValue(ACTOR);
  mockCan.mockResolvedValue(true);
  mockAccessFor.mockResolvedValue(access(5));
  mockRoleFindFirst.mockResolvedValue({ id: "sys:WORKSPACE:member", rank: 2 });
  mockUserFindUnique.mockResolvedValue(null);
  mockWorkspaceMemberFindUnique.mockResolvedValue(null);
}

const invite = (over: Partial<{ email: string; role: string }> = {}) =>
  inviteWorkspaceMember({
    workspaceId: WS,
    email: over.email ?? "ada@example.com",
    role: over.role ?? "member",
  });

describe("inviteWorkspaceMember() — Zugriffsschutz", () => {
  beforeEach(reset);

  it("lehnt ab, wenn niemand eingeloggt ist", async () => {
    mockCurrentUserId.mockResolvedValue(null);
    expect(await invite()).toEqual({ error: "You must be logged in." });
  });

  it("verlangt member.invite im Workspace", async () => {
    mockCan.mockResolvedValue(false);
    expect(await invite()).toEqual({
      error: "You are not allowed to invite people to this workspace.",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("prüft im Workspace-Kontext", async () => {
    await invite();
    expect(mockCan).toHaveBeenCalledWith(ACTOR, "member.invite", {
      workspaceId: WS,
    });
  });
});

describe("inviteWorkspaceMember() — Rolle und Adresse", () => {
  beforeEach(reset);

  it("lehnt eine unsinnige Adresse ab", async () => {
    expect(await invite({ email: "keine-adresse" })).toEqual({
      error: "Please enter a valid email address.",
    });
  });

  it("vergibt die Owner-Rolle nicht", async () => {
    expect(await invite({ role: "owner" })).toEqual({
      error: "The owner role cannot be handed out.",
    });
  });

  it("lehnt eine unbekannte Rolle ab", async () => {
    mockRoleFindFirst.mockResolvedValue(null);
    expect(await invite({ role: "gibtsnicht" })).toEqual({
      error: "Pick a valid role.",
    });
  });

  it("vergibt keine Rolle über dem eigenen Rang", async () => {
    mockAccessFor.mockResolvedValue(access(2));
    mockRoleFindFirst.mockResolvedValue({ id: "sys:WORKSPACE:admin", rank: 5 });
    expect(await invite({ role: "admin" })).toEqual({
      error: "You cannot assign a role above your own.",
    });
  });
});

describe("inviteWorkspaceMember() — bekanntes Konto", () => {
  beforeEach(reset);

  it("nimmt es ohne Einladung auf — anmelden kann es sich schon", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "u-1" });

    const result = await invite();

    expect(result).toEqual({ ok: true });
    expect(mockTx.workspaceMember.create.mock.calls[0][0].data).toMatchObject({
      userId: "u-1",
      pending: false,
    });
    expect(mockTx.invitation.create).not.toHaveBeenCalled();
    // Und es landet in den öffentlichen Projekten.
    expect(mockTx.projectMember.createMany).toHaveBeenCalled();
  });

  it("merkt, wenn die Person schon dabei ist", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "u-1" });
    mockWorkspaceMemberFindUnique.mockResolvedValue({ userId: "u-1" });
    expect(await invite()).toEqual({
      error: "This person is already in the workspace.",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

describe("inviteWorkspaceMember() — unbekannte Adresse", () => {
  beforeEach(reset);

  it("legt ein Konto ohne Passwort an und stellt einen Token aus", async () => {
    const result = await invite();

    expect(result).toMatchObject({ ok: true });
    expect("inviteUrl" in result && result.inviteUrl).toContain("/invite/");

    const created = mockTx.user.create.mock.calls[0][0].data;
    expect(created.email).toBe("ada@example.com");
    expect(created.passwordHash).toBeUndefined();
    // Vorname aus dem lokalen Teil, bis die Person ihn selbst setzt.
    expect(created.firstName).toBe("Ada");

    expect(mockTx.workspaceMember.create.mock.calls[0][0].data.pending).toBe(
      true,
    );
    expect(mockTx.invitation.create).toHaveBeenCalled();
  });

  it("normalisiert die Adresse", async () => {
    await invite({ email: "  ADA@Example.COM " });
    expect(mockUserFindUnique.mock.calls[0][0].where.email).toBe(
      "ada@example.com",
    );
  });
});
