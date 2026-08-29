import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockProjectFindUnique = mock();
const mockRoleFindFirst = mock();
const mockWorkspaceMemberFindMany = mock();
const mockProjectMemberFindUnique = mock();
const mockProjectMemberFindMany = mock();
const mockProjectMemberCreateMany = mock();
const mockProjectMemberCreate = mock();
const mockProjectMemberUpdate = mock();
const mockProjectMemberDelete = mock();
const mockUserFindUnique = mock();
const mockUserFindMany = mock();
const mockUserPreferencesFindMany = mock();
const mockNotificationCreateMany = mock();
const mockInviteLinkUpdateMany = mock();
const mockInviteLinkCreate = mock();
const mockTransaction = mock();

// The tx client for the new-account invite path: account, workspace
// membership, and the project entries all get created together there.
const mockTx = {
  user: { create: mock() },
  workspaceMember: { create: mock(), findUnique: mock() },
  project: { findMany: mock() },
  projectMember: { createMany: mock(), upsert: mock() },
  // The new-account invite path issues a token — the account has no
  // password, so without it nobody could get in.
  invitation: { deleteMany: mock(), create: mock() },
};

mock.module("@/lib/db", () => ({
  db: {
    project: { findUnique: mockProjectFindUnique, create: mock() },
    role: { findFirst: mockRoleFindFirst },
    user: { findUnique: mockUserFindUnique, findMany: mockUserFindMany },
    workspaceMember: {
      findMany: mockWorkspaceMemberFindMany,
      findUnique: mock(),
    },
    projectMember: {
      findUnique: mockProjectMemberFindUnique,
      findMany: mockProjectMemberFindMany,
      createMany: mockProjectMemberCreateMany,
      create: mockProjectMemberCreate,
      update: mockProjectMemberUpdate,
      delete: mockProjectMemberDelete,
    },
    userPreferences: { findMany: mockUserPreferencesFindMany },
    notification: { createMany: mockNotificationCreateMany },
    auditLog: { create: mock(async () => ({})) },
    inviteLink: {
      updateMany: mockInviteLinkUpdateMany,
      create: mockInviteLinkCreate,
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
  // Pure function — reimplemented here from the original, so the ranking
  // rule is actually exercised by the test instead of being mocked away.
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
  createProjectInviteLink,
  inviteProjectMember,
  inviteProjectMembers,
  removeProjectMember,
  setProjectMemberRole,
} from "@/features/projects/actions";

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROJECT = "p-1";
const WS = "acme";
const ACTOR = "u-actor";

/** The three member permissions together — the normal case for a management role. */
const MANAGE = ["member.invite", "member.remove", "member.role.update"];

/** An actor with permissions and a rank at the project level. */
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

/** Default state: may manage, holds no project role themselves (rank open). */
function reset() {
  for (const m of [
    mockProjectFindUnique,
    mockRoleFindFirst,
    mockWorkspaceMemberFindMany,
    mockProjectMemberFindUnique,
    mockProjectMemberFindMany,
    mockProjectMemberCreateMany,
    mockProjectMemberCreate,
    mockProjectMemberUpdate,
    mockProjectMemberDelete,
    mockUserFindUnique,
    mockUserFindMany,
    mockUserPreferencesFindMany,
    mockNotificationCreateMany,
    mockInviteLinkUpdateMany,
    mockInviteLinkCreate,
    mockTransaction,
    mockCan,
    mockCurrentUserId,
    mockAccessFor,
  ]) {
    m.mockReset();
  }
  mockInviteLinkUpdateMany.mockResolvedValue({ count: 0 });
  mockInviteLinkCreate.mockResolvedValue({});

  for (const group of Object.values(mockTx)) {
    for (const fn of Object.values(group)) {
      fn.mockReset();
      fn.mockResolvedValue({});
    }
  }
  mockTx.user.create.mockResolvedValue({ id: "u-new" });
  // The new membership is the default role — this becomes a Contributor
  // role in the projects.
  mockTx.workspaceMember.findUnique.mockResolvedValue({
    role: {
      key: "member",
      permissions: [{ permissionKey: "label.create" }],
    },
  });
  mockTx.project.findMany.mockResolvedValue([{ id: PROJECT }, { id: "p-2" }]);
  mockTransaction.mockImplementation(
    async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
  );

  mockCurrentUserId.mockResolvedValue(ACTOR);
  // The actor may invite; the target is a regular member without the
  // master permission — otherwise it couldn't be touched here at all.
  mockCan.mockImplementation(
    async (_userId: string, permission: string) =>
      permission !== "project.admin.all",
  );
  mockAccessFor.mockResolvedValue(access(MANAGE, null));
  mockProjectFindUnique.mockResolvedValue({ workspaceId: WS });
  mockRoleFindFirst.mockResolvedValue({ id: "wsp:acme:contributor", rank: 3 });
  mockWorkspaceMemberFindMany.mockResolvedValue([{ userId: "u-1" }]);
  // By default nobody is in the project yet — otherwise a freshly enrolled
  // person wouldn't get an "invite" notification.
  mockProjectMemberFindMany.mockResolvedValue([]);
  mockProjectMemberCreateMany.mockResolvedValue({ count: 1 });
  mockProjectMemberCreate.mockResolvedValue({});
  mockProjectMemberUpdate.mockResolvedValue({});
  mockProjectMemberDelete.mockResolvedValue({});
  mockUserFindMany.mockResolvedValue([]);
  mockUserPreferencesFindMany.mockResolvedValue([]);
  mockNotificationCreateMany.mockResolvedValue({ count: 0 });
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

  it("lehnt ab, wenn member.invite fehlt", async () => {
    mockAccessFor.mockResolvedValue(access([], null));
    expect(await add()).toHaveProperty("error");
    expect(mockProjectMemberCreateMany).not.toHaveBeenCalled();
  });

  // The three member permissions can be granted individually. Someone who
  // may only re-role or remove members doesn't get to enroll anyone new.
  it("genügt member.role.update nicht zum Aufnehmen", async () => {
    mockAccessFor.mockResolvedValue(access(["member.role.update"], null));
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
    mockAccessFor.mockResolvedValue(access(MANAGE, 2));
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
    // A workspace role like "owner" isn't found here — project and workspace
    // roles have been separate pools since the three-tier RBAC.
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
    mockAccessFor.mockResolvedValue(access(MANAGE, 3));
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
        {
          projectId: PROJECT,
          userId: "u-1",
          roleId: "wsp:acme:contributor",
          origin: "manual",
        },
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

  it("verlangt member.role.update — member.invite genügt nicht", async () => {
    mockAccessFor.mockResolvedValue(access(["member.invite"], null));
    mockProjectMemberFindUnique.mockResolvedValue({ role: { rank: 2 } });

    expect(await setProjectMemberRole(PROJECT, "u-1", "contributor")).toEqual({
      error: "You are not allowed to manage members of this project.",
    });
    expect(mockProjectMemberUpdate).not.toHaveBeenCalled();
  });

  it("ändert die eigene Rolle nicht", async () => {
    mockProjectMemberFindUnique.mockResolvedValue({ role: { rank: 2 } });
    expect(await setProjectMemberRole(PROJECT, ACTOR, "contributor")).toEqual({
      error: "You cannot change your own role here.",
    });
    expect(mockProjectMemberUpdate).not.toHaveBeenCalled();
  });

  it("ändert kein höher gestelltes Mitglied", async () => {
    mockAccessFor.mockResolvedValue(access(MANAGE, 2));
    mockRoleFindFirst.mockResolvedValue({
      id: "wsp:acme:project_viewer",
      rank: 2,
    });
    // Target is Project Admin (rank 4) — above the caller.
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
      data: { roleId: "wsp:acme:contributor", origin: "manual" },
    });
  });

  it("stuft die Leitung des Workspace nicht herab", async () => {
    // Whoever holds the master permission keeps their access regardless —
    // the row would only be asserting something in the table that isn't true.
    mockCan.mockResolvedValue(true);
    mockProjectMemberFindUnique.mockResolvedValue({ role: { rank: 4 } });

    expect(await setProjectMemberRole(PROJECT, "u-1", "contributor")).toEqual({
      error: "This member has full access to every project of the workspace.",
    });
    expect(mockProjectMemberUpdate).not.toHaveBeenCalled();
  });
});

describe("removeProjectMember()", () => {
  beforeEach(reset);

  it("verlangt member.remove — member.invite genügt nicht", async () => {
    mockAccessFor.mockResolvedValue(access(["member.invite"], null));
    mockProjectMemberFindUnique.mockResolvedValue({ role: { rank: 2 } });

    expect(await removeProjectMember(PROJECT, "u-1")).toEqual({
      error: "You are not allowed to manage members of this project.",
    });
    expect(mockProjectMemberDelete).not.toHaveBeenCalled();
  });

  it("entfernt nicht die eigene Person", async () => {
    mockProjectMemberFindUnique.mockResolvedValue({ role: { rank: 2 } });
    expect(await removeProjectMember(PROJECT, ACTOR)).toEqual({
      error: "You cannot remove yourself from the project.",
    });
    expect(mockProjectMemberDelete).not.toHaveBeenCalled();
  });

  it("entfernt den Projekt-Eintrag — und damit den Zugriff", async () => {
    mockProjectMemberFindUnique.mockResolvedValue({
      role: { rank: 3 },
      user: { firstName: "Ada", lastName: "Lovelace" },
    });
    expect(await removeProjectMember(PROJECT, "u-1")).toEqual({ ok: true });
    expect(mockProjectMemberDelete).toHaveBeenCalledWith({
      where: { projectId_userId: { projectId: PROJECT, userId: "u-1" } },
    });
  });

  it("entfernt die Leitung des Workspace nicht", async () => {
    mockCan.mockResolvedValue(true);
    mockProjectMemberFindUnique.mockResolvedValue({ role: { rank: 4 } });

    expect(await removeProjectMember(PROJECT, "u-1")).toEqual({
      error: "This member has full access to every project of the workspace.",
    });
    expect(mockProjectMemberDelete).not.toHaveBeenCalled();
  });

  it("entfernt kein höher gestelltes Mitglied", async () => {
    mockAccessFor.mockResolvedValue(access(MANAGE, 2));
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
    mockUserFindUnique.mockResolvedValue({
      id: "u-9",
      firstName: "Ada",
      lastName: "Lovelace",
    });
    mockProjectMemberFindUnique.mockResolvedValue(null);

    const result = await inviteProjectMember({
      projectId: PROJECT,
      email: "Ada@Example.com",
      role: "contributor",
    });

    expect(result).toEqual({ ok: true });
    // Address normalized, no new account.
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { email: "ada@example.com" },
      select: { id: true, firstName: true, lastName: true, color: true },
    });
    expect(mockProjectMemberCreate).toHaveBeenCalledWith({
      data: {
        projectId: PROJECT,
        userId: "u-9",
        roleId: "wsp:acme:contributor",
        origin: "manual",
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

  it("verlangt member.invite im Workspace für eine unbekannte Adresse", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    // The project may be managed, but not new accounts.
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

    // The account has no password — so the response carries the invite link.
    expect(result).toMatchObject({ ok: true });
    expect("inviteUrl" in result && result.inviteUrl).toContain("/invite/");
    expect(mockTx.invitation.create).toHaveBeenCalled();
    expect(mockTx.workspaceMember.create).toHaveBeenCalled();
    // The derived role in every public project of the workspace …
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
    // … and the invited role in the inviting project itself.
    expect(mockTx.projectMember.upsert).toHaveBeenCalledWith({
      where: { projectId_userId: { projectId: PROJECT, userId: "u-new" } },
      update: { roleId: "wsp:acme:contributor", origin: "manual" },
      create: {
        projectId: PROJECT,
        userId: "u-new",
        roleId: "wsp:acme:contributor",
        origin: "manual",
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

    expect(result).toMatchObject({ ok: true });
    expect(mockTx.workspaceMember.create).not.toHaveBeenCalled();
    expect(mockTx.projectMember.createMany).not.toHaveBeenCalled();
    expect(mockTx.projectMember.upsert).toHaveBeenCalled();
    // Even a guest needs their invite link: the account is new.
    expect(mockTx.invitation.create).toHaveBeenCalled();
  });
});

describe("inviteProjectMembers()", () => {
  beforeEach(reset);

  it("lädt mehrere Adressen ein und liefert ein Ergebnis pro Zeile", async () => {
    mockUserFindUnique.mockImplementation(
      async ({ where }: { where: { email: string } }) =>
        where.email === "bekannt@example.com"
          ? { id: "u-9", firstName: "Ada", lastName: "Lovelace" }
          : null,
    );
    mockProjectMemberFindUnique.mockResolvedValue(null);

    const result = await inviteProjectMembers({
      projectId: PROJECT,
      emails: ["bekannt@example.com", "neu@example.com"],
      role: "contributor",
    });

    if ("error" in result) throw new Error("unerwarteter Fehler");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      email: "bekannt@example.com",
      result: { ok: true },
    });
    expect(result.rows[1].email).toBe("neu@example.com");
    expect(
      "inviteUrl" in result.rows[1].result && result.rows[1].result.inviteUrl,
    ).toContain("/invite/");
  });

  it("meldet eine ungültige Adresse nur für diese Zeile", async () => {
    const result = await inviteProjectMembers({
      projectId: PROJECT,
      emails: ["keine-adresse", "neu@example.com"],
      role: "contributor",
    });

    if ("error" in result) throw new Error("unerwarteter Fehler");
    expect(result.rows[0].result).toEqual({
      error: "Please enter a valid email address.",
    });
    expect(result.rows[1].result).toMatchObject({ ok: true });
  });

  it("deckelt die Anzahl pro Aufruf", async () => {
    const emails = Array.from(
      { length: 51 },
      (_, i) => `person${i}@example.com`,
    );
    expect(
      await inviteProjectMembers({
        projectId: PROJECT,
        emails,
        role: "contributor",
      }),
    ).toEqual({ error: "You can invite at most 50 people at once." });
  });

  it("prüft die Workspace-Berechtigung für Neukonten nur einmal, nicht pro Adresse", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    await inviteProjectMembers({
      projectId: PROJECT,
      emails: ["a@example.com", "b@example.com"],
      role: "contributor",
    });

    // `can` is called for "member.invite" in the workspace exactly once —
    // not once per newly created account.
    const workspaceInviteChecks = mockCan.mock.calls.filter(
      ([, permission]) => permission === "member.invite",
    );
    expect(workspaceInviteChecks).toHaveLength(1);
  });
});

describe("createProjectInviteLink()", () => {
  beforeEach(reset);

  it("lehnt ab ohne member.invite im Projekt", async () => {
    mockAccessFor.mockResolvedValue(access([], null));
    expect(await createProjectInviteLink(PROJECT, "contributor")).toEqual({
      error: "You are not allowed to manage members of this project.",
    });
    expect(mockInviteLinkCreate).not.toHaveBeenCalled();
  });

  it("vergibt keine Rolle über dem eigenen Rang", async () => {
    mockAccessFor.mockResolvedValue(access(MANAGE, 2));
    mockRoleFindFirst.mockResolvedValue({ id: "wsp:acme:admin", rank: 5 });
    expect(await createProjectInviteLink(PROJECT, "admin")).toEqual({
      error: "You cannot assign a role above your own.",
    });
  });

  it("erzeugt einen Link und widerruft einen vorherigen für denselben Scope", async () => {
    const result = await createProjectInviteLink(PROJECT, "contributor");

    expect(result).toMatchObject({ ok: true });
    expect("url" in result && result.url).toContain("/join/");
    expect(mockInviteLinkUpdateMany).toHaveBeenCalledWith({
      where: {
        workspaceId: WS,
        projectId: PROJECT,
        roleId: "wsp:acme:contributor",
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mockInviteLinkCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: WS,
        projectId: PROJECT,
        roleId: "wsp:acme:contributor",
        createdById: ACTOR,
      }),
    });
  });
});
