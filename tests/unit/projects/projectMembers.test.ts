import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockProjectFindUnique = mock();
const mockRoleFindFirst = mock();
const mockWorkspaceMemberFindMany = mock();
const mockProjectMemberFindUnique = mock();
const mockProjectMemberCreateMany = mock();
const mockProjectMemberCreate = mock();
const mockProjectMemberUpdate = mock();
const mockProjectMemberDelete = mock();
const mockUserFindUnique = mock();
const mockTransaction = mock();

// Der Tx-Client für den Einladungsweg mit neuem Account: dort entstehen Konto,
// Workspace-Mitgliedschaft und die Projekt-Einträge zusammen.
const mockTx = {
  user: { create: mock() },
  workspaceMember: { create: mock(), findUnique: mock() },
  project: { findMany: mock() },
  projectMember: { createMany: mock(), upsert: mock() },
};

mock.module("@/lib/db", () => ({
  db: {
    project: { findUnique: mockProjectFindUnique, create: mock() },
    role: { findFirst: mockRoleFindFirst },
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
  hasPermission: mock(),
  // Reine Funktion — hier im Original nachgebildet, damit die Rangregel
  // wirklich mitgetestet wird und nicht wegge­mockt ist.
  assignmentCeiling: (
    access: {
      roleKey: (l: string) => string | null;
      rank: (l: string) => number;
    },
    level: string,
  ) =>
    access.roleKey(level) === null
      ? Number.POSITIVE_INFINITY
      : access.rank(level),
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

/** Ein Handelnder mit Rechten und einem Rang auf der Projekt-Ebene. */
function access(permissions: string[], projectRank: number | null) {
  return {
    has: (p: string) => permissions.includes(p),
    rank: (level: string) => (level === "PROJECT" ? (projectRank ?? -1) : -1),
    roleKey: (level: string) =>
      level === "PROJECT" && projectRank !== null ? "some-role" : null,
    workspaceId: WS,
    projectId: PROJECT,
  };
}

/** Standardlage: darf verwalten, trägt selbst keine Projektrolle (Rang offen). */
function reset() {
  for (const m of [
    mockProjectFindUnique,
    mockRoleFindFirst,
    mockWorkspaceMemberFindMany,
    mockProjectMemberFindUnique,
    mockProjectMemberCreateMany,
    mockProjectMemberCreate,
    mockProjectMemberUpdate,
    mockProjectMemberDelete,
    mockUserFindUnique,
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
  // Die neue Mitgliedschaft ist die Standardrolle — daraus wird eine
  // Contributor-Rolle in den Projekten.
  mockTx.workspaceMember.findUnique.mockResolvedValue({
    role: {
      permissions: [
        { permissionKey: "project.view", effect: "ALLOW" },
        { permissionKey: "issue.create", effect: "ALLOW" },
      ],
    },
  });
  mockTx.project.findMany.mockResolvedValue([{ id: PROJECT }, { id: "p-2" }]);
  mockTransaction.mockImplementation(
    async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
  );

  mockCurrentUserId.mockResolvedValue(ACTOR);
  // Der Handelnde darf einladen; das Ziel ist ein normales Mitglied und sieht
  // nicht jedes Projekt — sonst ließe es sich hier gar nicht anfassen.
  mockCan.mockImplementation(
    async (_userId: string, permission: string) =>
      permission !== "project.view.all",
  );
  mockAccessFor.mockResolvedValue(
    access(["member.invite", "member.invite"], null),
  );
  mockProjectFindUnique.mockResolvedValue({ workspaceId: WS });
  mockRoleFindFirst.mockResolvedValue({ id: "wsp:acme:contributor", rank: 3 });
  mockWorkspaceMemberFindMany.mockResolvedValue([{ userId: "u-1" }]);
  mockProjectMemberCreateMany.mockResolvedValue({ count: 1 });
  mockProjectMemberCreate.mockResolvedValue({});
  mockProjectMemberUpdate.mockResolvedValue({});
  mockProjectMemberDelete.mockResolvedValue({});
}

const add = () =>
  addProjectMembers({
    projectId: PROJECT,
    userIds: ["u-1"],
    role: "contributor",
  });

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("addProjectMembers() — Zugriffsschutz", () => {
  beforeEach(reset);

  it("lehnt ab, wenn niemand eingeloggt ist", async () => {
    mockCurrentUserId.mockResolvedValue(null);
    expect(await add()).toEqual({ error: "You must be logged in." });
    expect(mockProjectMemberCreateMany).not.toHaveBeenCalled();
  });

  it("lehnt ab, wenn project.member.manage fehlt", async () => {
    mockAccessFor.mockResolvedValue(access([], null));
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
    mockAccessFor.mockResolvedValue(access(["member.invite"], 2));
    mockRoleFindFirst.mockResolvedValue({
      id: "wsp:acme:project_admin",
      rank: 4,
    });

    const result = await addProjectMembers({
      projectId: PROJECT,
      userIds: ["u-1"],
      role: "project_admin",
    });
    expect(result).toEqual({
      error: "You cannot assign a role above your own.",
    });
    expect(mockProjectMemberCreateMany).not.toHaveBeenCalled();
  });

  it("lehnt Rollen ab, die es auf der Projekt-Ebene nicht gibt", async () => {
    // Eine Workspace-Rolle wie "owner" findet sich hier nicht — Projekt- und
    // Workspace-Rollen sind seit dem dreistufigen RBAC getrennte Töpfe.
    mockRoleFindFirst.mockResolvedValue(null);
    const result = await addProjectMembers({
      projectId: PROJECT,
      userIds: ["u-1"],
      role: "owner",
    });
    expect(result).toEqual({ error: "Pick a valid role." });
  });

  it("lehnt eine leere Rolle ab", async () => {
    const result = await addProjectMembers({
      projectId: PROJECT,
      userIds: ["u-1"],
      role: "",
    });
    expect(result).toEqual({ error: "Pick a valid role." });
  });

  it("erlaubt eine Rolle auf Augenhöhe", async () => {
    mockAccessFor.mockResolvedValue(access(["member.invite"], 3));
    mockRoleFindFirst.mockResolvedValue({
      id: "wsp:acme:contributor",
      rank: 3,
    });
    expect(await add()).toEqual({ ok: true });
  });

  it("sucht geteilte, workspaceweite und projektlokale Rollen", async () => {
    await add();
    const where = mockRoleFindFirst.mock.calls[0][0].where;
    expect(where.scope).toBe("PROJECT");
    expect(where.OR).toEqual([
      { system: true },
      { workspaceId: WS, projectId: null },
      { projectId: PROJECT },
    ]);
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
      role: "contributor",
    });
    expect(result).toEqual({ error: "Pick at least one member." });
  });

  it("überschreibt bestehende Einträge nicht", async () => {
    expect(await add()).toEqual({ ok: true });
    expect(mockProjectMemberCreateMany).toHaveBeenCalledWith({
      data: [
        { projectId: PROJECT, userId: "u-1", roleId: "wsp:acme:contributor" },
      ],
      skipDuplicates: true,
    });
  });

  it("entdoppelt die übergebenen User-Ids", async () => {
    mockWorkspaceMemberFindMany.mockResolvedValue([{ userId: "u-1" }]);
    await addProjectMembers({
      projectId: PROJECT,
      userIds: ["u-1", "u-1"],
      role: "contributor",
    });
    expect(mockProjectMemberCreateMany.mock.calls[0][0].data).toHaveLength(1);
  });
});

describe("setProjectMemberRole()", () => {
  beforeEach(reset);

  it("ändert kein höher gestelltes Mitglied", async () => {
    mockAccessFor.mockResolvedValue(access(["member.invite"], 2));
    mockRoleFindFirst.mockResolvedValue({
      id: "wsp:acme:project_viewer",
      rank: 2,
    });
    // Ziel ist Project Admin (Rang 4) — über dem Aufrufer.
    mockProjectMemberFindUnique.mockResolvedValue({ role: { rank: 4 } });

    const result = await setProjectMemberRole(PROJECT, "u-1", "project_viewer");
    expect(result).toEqual({
      error: "You cannot change a member ranked above you.",
    });
    expect(mockProjectMemberUpdate).not.toHaveBeenCalled();
  });

  it("lehnt ab, wenn es gar keinen Projekt-Eintrag gibt", async () => {
    mockProjectMemberFindUnique.mockResolvedValue(null);
    const result = await setProjectMemberRole(PROJECT, "u-1", "contributor");
    expect(result).toEqual({
      error: "This person is not a member of the project.",
    });
  });

  it("schreibt die neue Rolle", async () => {
    mockProjectMemberFindUnique.mockResolvedValue({ role: { rank: 2 } });
    expect(await setProjectMemberRole(PROJECT, "u-1", "contributor")).toEqual({
      ok: true,
    });
    expect(mockProjectMemberUpdate).toHaveBeenCalledWith({
      where: { projectId_userId: { projectId: PROJECT, userId: "u-1" } },
      data: { roleId: "wsp:acme:contributor" },
    });
  });

  it("stuft die Leitung des Workspace nicht herab", async () => {
    // Wer jedes Projekt sieht, behält seine Rechte ohnehin — der Eintrag würde
    // in der Tabelle nur etwas behaupten, was nicht gilt.
    mockCan.mockResolvedValue(true);
    mockProjectMemberFindUnique.mockResolvedValue({ role: { rank: 4 } });

    expect(await setProjectMemberRole(PROJECT, "u-1", "contributor")).toEqual({
      error: "This member sees every project of the workspace.",
    });
    expect(mockProjectMemberUpdate).not.toHaveBeenCalled();
  });
});

describe("removeProjectMember()", () => {
  beforeEach(reset);

  it("entfernt den Projekt-Eintrag — und damit den Zugriff", async () => {
    mockProjectMemberFindUnique.mockResolvedValue({ role: { rank: 3 } });
    expect(await removeProjectMember(PROJECT, "u-1")).toEqual({ ok: true });
    expect(mockProjectMemberDelete).toHaveBeenCalledWith({
      where: { projectId_userId: { projectId: PROJECT, userId: "u-1" } },
    });
  });

  it("entfernt die Leitung des Workspace nicht", async () => {
    mockCan.mockResolvedValue(true);
    mockProjectMemberFindUnique.mockResolvedValue({ role: { rank: 4 } });

    expect(await removeProjectMember(PROJECT, "u-1")).toEqual({
      error: "This member sees every project of the workspace.",
    });
    expect(mockProjectMemberDelete).not.toHaveBeenCalled();
  });

  it("entfernt kein höher gestelltes Mitglied", async () => {
    mockAccessFor.mockResolvedValue(access(["member.invite"], 2));
    mockProjectMemberFindUnique.mockResolvedValue({ role: { rank: 4 } });
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
      role: "contributor",
    });
    expect(result).toEqual({ error: "Please enter a valid email address." });
  });

  it("hängt einen bestehenden Account direkt ans Projekt", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "u-9" });
    mockProjectMemberFindUnique.mockResolvedValue(null);

    const result = await inviteProjectMember({
      projectId: PROJECT,
      email: "Ada@Example.com",
      role: "contributor",
    });

    expect(result).toEqual({ ok: true });
    // Adresse normalisiert, kein neuer Account.
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { email: "ada@example.com" },
      select: { id: true },
    });
    expect(mockProjectMemberCreate).toHaveBeenCalledWith({
      data: {
        projectId: PROJECT,
        userId: "u-9",
        roleId: "wsp:acme:contributor",
      },
    });
  });

  it("meldet, wenn die Person schon im Projekt ist", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "u-9" });
    mockProjectMemberFindUnique.mockResolvedValue({ userId: "u-9" });

    const result = await inviteProjectMember({
      projectId: PROJECT,
      email: "ada@example.com",
      role: "contributor",
    });
    expect(result).toEqual({ error: "This person is already in the project." });
    expect(mockProjectMemberCreate).not.toHaveBeenCalled();
  });

  it("verlangt workspace.member.invite für eine unbekannte Adresse", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    // Projekt darf verwaltet werden, neue Accounts aber nicht.
    mockCan.mockImplementation(
      async (_userId: string, permission: string) =>
        permission !== "member.invite",
    );

    const result = await inviteProjectMember({
      projectId: PROJECT,
      email: "neu@example.com",
      role: "contributor",
    });
    expect(result).toEqual({
      error: "You are not allowed to invite new people to this workspace.",
    });
  });

  it("trägt einen neuen Account in allen öffentlichen Projekten ein", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const result = await inviteProjectMember({
      projectId: PROJECT,
      email: "neu@example.com",
      role: "contributor",
    });

    expect(result).toEqual({ ok: true });
    expect(mockTx.workspaceMember.create).toHaveBeenCalled();
    // Die abgeleitete Rolle in jedem öffentlichen Projekt des Workspace …
    expect(mockTx.projectMember.createMany).toHaveBeenCalledWith({
      data: [
        {
          projectId: PROJECT,
          userId: "u-new",
          roleId: "sys:PROJECT:contributor",
        },
        {
          projectId: "p-2",
          userId: "u-new",
          roleId: "sys:PROJECT:contributor",
        },
      ],
      skipDuplicates: true,
    });
    // … und im einladenden Projekt die eingeladene Rolle.
    expect(mockTx.projectMember.upsert).toHaveBeenCalledWith({
      where: { projectId_userId: { projectId: PROJECT, userId: "u-new" } },
      update: { roleId: "wsp:acme:contributor" },
      create: {
        projectId: PROJECT,
        userId: "u-new",
        roleId: "wsp:acme:contributor",
      },
    });
  });

  it("lässt einen Gast außerhalb des Workspace und der anderen Projekte", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockRoleFindFirst.mockResolvedValue({
      id: "sys:PROJECT:project_guest",
      rank: 1,
    });

    const result = await inviteProjectMember({
      projectId: PROJECT,
      email: "gast@example.com",
      role: "project_guest",
    });

    expect(result).toEqual({ ok: true });
    expect(mockTx.workspaceMember.create).not.toHaveBeenCalled();
    expect(mockTx.projectMember.createMany).not.toHaveBeenCalled();
    expect(mockTx.projectMember.upsert).toHaveBeenCalled();
  });
});
