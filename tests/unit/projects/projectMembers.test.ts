import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockProjectFindUnique = mock();
const mockRoleFindUnique = mock();
const mockWorkspaceMemberFindMany = mock();
const mockProjectMemberFindUnique = mock();
const mockProjectMemberCreateMany = mock();
const mockProjectMemberCreate = mock();
const mockProjectMemberUpdate = mock();
const mockProjectMemberDelete = mock();
const mockUserFindUnique = mock();

mock.module("@/lib/db", () => ({
  db: {
    project: { findUnique: mockProjectFindUnique, create: mock() },
    role: { findUnique: mockRoleFindUnique },
    user: { findUnique: mockUserFindUnique },
    workspaceMember: {
      findMany: mockWorkspaceMemberFindMany,
      findUnique: mock(),
    },
    projectMember: {
      findUnique: mockProjectMemberFindUnique,
      createMany: mockProjectMemberCreateMany,
      create: mockProjectMemberCreate,
      update: mockProjectMemberUpdate,
      delete: mockProjectMemberDelete,
    },
    $transaction: mock(),
  },
}));

const mockCan = mock();
const mockCurrentUserId = mock();
const mockEffectiveRoleKey = mock();

mock.module("@/lib/permissions", () => ({
  can: mockCan,
  currentUserId: mockCurrentUserId,
  effectiveRoleKey: mockEffectiveRoleKey,
  hasPermission: mock(),
}));

mock.module("@/lib/session", () => ({ getSession: mock() }));
mock.module("next/cache", () => ({ revalidatePath: mock() }));
mock.module("@/lib/user-defaults", () => ({
  generateHandle: mock(async () => "ada"),
  pickUserColor: () => "#6e63e6",
}));

import {
  addProjectMembers,
  inviteProjectMember,
  removeProjectMember,
  setProjectMemberRole,
} from "@/features/projects/actions";

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROJECT = "p-1";
const WS = "acme";
const ACTOR = "u-actor";

/** Standardlage: Admin (Rang 5) mit Verwaltungsrecht in einem echten Projekt. */
function reset() {
  for (const m of [
    mockProjectFindUnique,
    mockRoleFindUnique,
    mockWorkspaceMemberFindMany,
    mockProjectMemberFindUnique,
    mockProjectMemberCreateMany,
    mockProjectMemberCreate,
    mockProjectMemberUpdate,
    mockProjectMemberDelete,
    mockUserFindUnique,
    mockCan,
    mockCurrentUserId,
    mockEffectiveRoleKey,
  ]) {
    m.mockReset();
  }

  mockCurrentUserId.mockResolvedValue(ACTOR);
  mockCan.mockResolvedValue(true);
  mockEffectiveRoleKey.mockResolvedValue("admin");
  mockProjectFindUnique.mockResolvedValue({ workspaceId: WS });
  mockRoleFindUnique.mockResolvedValue({ key: "member" });
  mockWorkspaceMemberFindMany.mockResolvedValue([{ userId: "u-1" }]);
  mockProjectMemberCreateMany.mockResolvedValue({ count: 1 });
  mockProjectMemberCreate.mockResolvedValue({});
  mockProjectMemberUpdate.mockResolvedValue({});
  mockProjectMemberDelete.mockResolvedValue({});
}

const add = () =>
  addProjectMembers({ projectId: PROJECT, userIds: ["u-1"], role: "member" });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("addProjectMembers() — Zugriffsschutz", () => {
  beforeEach(reset);

  it("lehnt ab, wenn niemand eingeloggt ist", async () => {
    mockCurrentUserId.mockResolvedValue(null);
    expect(await add()).toEqual({ error: "You must be logged in." });
    expect(mockProjectMemberCreateMany).not.toHaveBeenCalled();
  });

  it("lehnt ab, wenn project.member.manage fehlt", async () => {
    mockCan.mockResolvedValue(false);
    expect(await add()).toHaveProperty("error");
    expect(mockProjectMemberCreateMany).not.toHaveBeenCalled();
  });

  it("lehnt ab, wenn das Projekt nicht mehr existiert", async () => {
    mockProjectFindUnique.mockResolvedValue(null);
    expect(await add()).toEqual({ error: "This project no longer exists." });
  });
});

describe("addProjectMembers() — Rollen", () => {
  beforeEach(reset);

  it("vergibt keine Rolle über dem eigenen Rang", async () => {
    mockEffectiveRoleKey.mockResolvedValue("manager"); // Rang 4
    const result = await addProjectMembers({
      projectId: PROJECT,
      userIds: ["u-1"],
      role: "admin", // Rang 5
    });
    expect(result).toEqual({ error: "You cannot assign a role above your own." });
    expect(mockProjectMemberCreateMany).not.toHaveBeenCalled();
  });

  it("vergibt niemals 'owner' als Projektrolle", async () => {
    const result = await addProjectMembers({
      projectId: PROJECT,
      userIds: ["u-1"],
      role: "owner",
    });
    expect(result).toEqual({ error: "Pick a valid role." });
  });

  it("lehnt Rollen ab, die es in diesem Workspace nicht gibt", async () => {
    mockRoleFindUnique.mockResolvedValue(null);
    expect(await add()).toEqual({ error: "Pick a valid role." });
  });

  it("erlaubt eine Rolle auf Augenhöhe", async () => {
    mockEffectiveRoleKey.mockResolvedValue("manager");
    mockRoleFindUnique.mockResolvedValue({ key: "manager" });
    const result = await addProjectMembers({
      projectId: PROJECT,
      userIds: ["u-1"],
      role: "manager",
    });
    expect(result).toEqual({ ok: true });
  });
});

describe("addProjectMembers() — Aufnahme", () => {
  beforeEach(reset);

  it("nimmt nur auf, wer schon im Workspace ist", async () => {
    mockWorkspaceMemberFindMany.mockResolvedValue([]); // u-1 ist kein Mitglied
    expect(await add()).toEqual({
      error: "Some of those people are not in this workspace.",
    });
    expect(mockProjectMemberCreateMany).not.toHaveBeenCalled();
  });

  it("verlangt mindestens eine Person", async () => {
    const result = await addProjectMembers({
      projectId: PROJECT,
      userIds: [],
      role: "member",
    });
    expect(result).toEqual({ error: "Pick at least one member." });
  });

  it("überschreibt bestehende Einträge nicht", async () => {
    expect(await add()).toEqual({ ok: true });
    expect(mockProjectMemberCreateMany).toHaveBeenCalledWith({
      data: [{ projectId: PROJECT, userId: "u-1", role: "member" }],
      skipDuplicates: true,
    });
  });

  it("entdoppelt die übergebenen User-Ids", async () => {
    mockWorkspaceMemberFindMany.mockResolvedValue([{ userId: "u-1" }]);
    await addProjectMembers({
      projectId: PROJECT,
      userIds: ["u-1", "u-1"],
      role: "member",
    });
    expect(mockProjectMemberCreateMany.mock.calls[0][0].data).toHaveLength(1);
  });
});

describe("setProjectMemberRole()", () => {
  beforeEach(reset);

  it("ändert kein höher gestelltes Mitglied", async () => {
    mockEffectiveRoleKey.mockResolvedValue("member"); // Rang 2
    mockProjectMemberFindUnique.mockResolvedValue({ role: "member" });
    mockRoleFindUnique.mockResolvedValue({ key: "viewer" });
    // Ziel ist Manager (Rang 4) — über dem Aufrufer.
    mockProjectMemberFindUnique.mockResolvedValue({ role: "manager" });

    const result = await setProjectMemberRole(PROJECT, "u-1", "viewer");
    expect(result).toEqual({
      error: "You cannot change a member ranked above you.",
    });
    expect(mockProjectMemberUpdate).not.toHaveBeenCalled();
  });

  it("lehnt ab, wenn es gar keinen Projekt-Eintrag gibt", async () => {
    mockProjectMemberFindUnique.mockResolvedValue(null);
    const result = await setProjectMemberRole(PROJECT, "u-1", "member");
    expect(result).toEqual({
      error: "This person is not a member of the project.",
    });
  });

  it("schreibt die neue Rolle", async () => {
    mockProjectMemberFindUnique.mockResolvedValue({ role: "viewer" });
    expect(await setProjectMemberRole(PROJECT, "u-1", "member")).toEqual({
      ok: true,
    });
    expect(mockProjectMemberUpdate).toHaveBeenCalledWith({
      where: { projectId_userId: { projectId: PROJECT, userId: "u-1" } },
      data: { role: "member" },
    });
  });
});

describe("removeProjectMember()", () => {
  beforeEach(reset);

  it("entfernt den Projekt-Eintrag", async () => {
    mockProjectMemberFindUnique.mockResolvedValue({ role: "member" });
    expect(await removeProjectMember(PROJECT, "u-1")).toEqual({ ok: true });
    expect(mockProjectMemberDelete).toHaveBeenCalledWith({
      where: { projectId_userId: { projectId: PROJECT, userId: "u-1" } },
    });
  });

  it("entfernt kein höher gestelltes Mitglied", async () => {
    mockEffectiveRoleKey.mockResolvedValue("member");
    mockProjectMemberFindUnique.mockResolvedValue({ role: "admin" });
    expect(await removeProjectMember(PROJECT, "u-1")).toEqual({
      error: "You cannot remove a member ranked above you.",
    });
    expect(mockProjectMemberDelete).not.toHaveBeenCalled();
  });
});

describe("inviteProjectMember()", () => {
  beforeEach(reset);

  it("lehnt ungültige Adressen ab", async () => {
    const result = await inviteProjectMember({
      projectId: PROJECT,
      email: "keine-adresse",
      role: "member",
    });
    expect(result).toEqual({ error: "Please enter a valid email address." });
  });

  it("hängt einen bestehenden Account direkt ans Projekt", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "u-9" });
    mockProjectMemberFindUnique.mockResolvedValue(null);

    const result = await inviteProjectMember({
      projectId: PROJECT,
      email: "Ada@Example.com",
      role: "member",
    });

    expect(result).toEqual({ ok: true });
    // Adresse normalisiert, kein neuer Account.
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { email: "ada@example.com" },
      select: { id: true },
    });
    expect(mockProjectMemberCreate).toHaveBeenCalledWith({
      data: { projectId: PROJECT, userId: "u-9", role: "member" },
    });
  });

  it("meldet, wenn die Person schon im Projekt ist", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "u-9" });
    mockProjectMemberFindUnique.mockResolvedValue({ userId: "u-9" });

    const result = await inviteProjectMember({
      projectId: PROJECT,
      email: "ada@example.com",
      role: "member",
    });
    expect(result).toEqual({ error: "This person is already in the project." });
    expect(mockProjectMemberCreate).not.toHaveBeenCalled();
  });

  it("verlangt workspace.member.invite für eine unbekannte Adresse", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    // Projekt darf verwaltet werden, neue Accounts aber nicht.
    mockCan.mockImplementation(
      async (_userId: string, permission: string) =>
        permission !== "workspace.member.invite",
    );

    const result = await inviteProjectMember({
      projectId: PROJECT,
      email: "neu@example.com",
      role: "member",
    });
    expect(result).toEqual({
      error: "You are not allowed to invite new people to this workspace.",
    });
  });
});
