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
const mockTransaction = mock();

// Der Tx-Client für den Einladungsweg mit neuem Account: dort entstehen Konto,
// Workspace-Mitgliedschaft und die Projekt-Einträge zusammen.
const mockTx = {
  user: { create: mock() },
  workspaceMember: { create: mock(), findUnique: mock() },
  project: { findMany: mock() },
  projectMember: { createMany: mock(), upsert: mock() },
  // Der Einladungsweg mit neuem Account stellt einen Token aus — das Konto hat
  // kein Passwort, ohne ihn käme niemand hinein.
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

/** Die drei Mitglieder-Rechte zusammen — der Normalfall einer Verwaltungsrolle. */
const MANAGE = ["member.invite", "member.remove", "member.role.update"];

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
    mockProjectMemberFindMany,
    mockProjectMemberCreateMany,
    mockProjectMemberCreate,
    mockProjectMemberUpdate,
    mockProjectMemberDelete,
    mockUserFindUnique,
    mockUserFindMany,
    mockUserPreferencesFindMany,
    mockNotificationCreateMany,
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
      key: "member",
      permissions: [{ permissionKey: "label.create" }],
    },
  });
  mockTx.project.findMany.mockResolvedValue([{ id: PROJECT }, { id: "p-2" }]);
  mockTransaction.mockImplementation(
    async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
  );

  mockCurrentUserId.mockResolvedValue(ACTOR);
  // Der Handelnde darf einladen; das Ziel ist ein normales Mitglied ohne
  // Generalschlüssel — sonst ließe es sich hier gar nicht anfassen.
  mockCan.mockImplementation(
    async (_userId: string, permission: string) =>
      permission !== "project.admin.all",
  );
  mockAccessFor.mockResolvedValue(access(MANAGE, null));
  mockProjectFindUnique.mockResolvedValue({ workspaceId: WS });
  mockRoleFindFirst.mockResolvedValue({ id: "wsp:acme:contributor", rank: 3 });
  mockWorkspaceMemberFindMany.mockResolvedValue([{ userId: "u-1" }]);
  // Standardmäßig noch niemand im Projekt — sonst bekäme eine frisch
  // aufgenommene Person keine "invite"-Benachrichtigung.
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

  // Die drei Mitglieder-Rechte sind einzeln vergebbar. Wer nur umrollen oder
  // entfernen darf, nimmt niemanden neu auf.
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
      data: { roleId: "wsp:acme:contributor", origin: "manual" },
    });
  });

  it("stuft die Leitung des Workspace nicht herab", async () => {
    // Wer den Generalschlüssel trägt, behält seine Rechte ohnehin — der Eintrag
    // würde in der Tabelle nur etwas behaupten, was nicht gilt.
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

    // Das Konto hat kein Passwort — die Antwort trägt deshalb den Einladungslink.
    expect(result).toMatchObject({ ok: true });
    expect("inviteUrl" in result && result.inviteUrl).toContain("/invite/");
    expect(mockTx.invitation.create).toHaveBeenCalled();
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
    // Auch ein Gast braucht seinen Einladungslink: das Konto ist neu.
    expect(mockTx.invitation.create).toHaveBeenCalled();
  });
});
