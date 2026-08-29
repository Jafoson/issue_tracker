import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockTeamCreate = mock();
const mockTeamUpdate = mock();
const mockTeamDelete = mock();
const mockTeamFindUnique = mock();
const mockMemberCount = mock();
const mockProjectCount = mock();
const mockRoleFindFirst = mock();
const mockTransaction = mock();

const mockTx = {
  team: {
    create: mockTeamCreate,
    update: mockTeamUpdate,
    delete: mockTeamDelete,
  },
  teamMember: { deleteMany: mock(), createMany: mock(), findMany: mock() },
  teamProject: { deleteMany: mock(), createMany: mock(), findMany: mock() },
};

mock.module("@/lib/db", () => ({
  db: {
    team: {
      create: mockTeamCreate,
      update: mockTeamUpdate,
      delete: mockTeamDelete,
      findUnique: mockTeamFindUnique,
    },
    workspaceMember: { count: mockMemberCount },
    project: { count: mockProjectCount },
    role: { findFirst: mockRoleFindFirst },
    $transaction: mockTransaction,
  },
}));

const mockCan = mock();
const mockCurrentUserId = mock();
const mockAccessFor = mock();
const mockAssignmentCeiling = mock(() => Number.POSITIVE_INFINITY);

mock.module("@/lib/permissions", () => ({
  can: mockCan,
  currentUserId: mockCurrentUserId,
  accessFor: mockAccessFor,
  requirePermission: mock(),
  PermissionError: class PermissionError extends Error {},
  assignmentCeiling: mockAssignmentCeiling,
}));

// Team role synchronization itself has its own tests
// (tests/unit/projects/teamProjectRoles.test.ts) — what matters here is only
// that `createTeam`/`updateTeam`/`deleteTeam` call it with the correct ids.
const mockSyncProjectTeamRoles = mock();

mock.module("@/lib/project-membership", () => ({
  dropProjectMemberships: mock(),
  enrollInWorkspaceProjects: mock(),
  enrollWorkspaceMembers: mock(),
  syncProjectTeamRoles: mockSyncProjectTeamRoles,
}));

mock.module("@/lib/session", () => ({ getSession: mock() }));
mock.module("next/cache", () => ({ revalidatePath: mock() }));

import {
  createTeam,
  deleteTeam,
  updateTeam,
} from "@/features/workspaces/actions";

const WS = "acme";
const ACTOR = "u-actor";
const TEAM = "t-1";

const input = (over: Partial<Parameters<typeof createTeam>[1]> = {}) => ({
  name: "Plattform",
  key: "PLT",
  color: "#6e63e6",
  desc: "",
  leadId: "u-lead",
  memberIds: ["u-1"],
  // Without `roleKey` the link stays pure grouping — the same behavior
  // as before team project roles existed.
  projects: [{ projectId: "p-1", roleKey: null }],
  ...over,
});

/** Which of the three team permissions the actor has. */
function grants(map: Record<string, boolean>) {
  mockCan.mockImplementation(async (_id: string, permission: string) =>
    permission in map ? map[permission] : false,
  );
}

function reset() {
  for (const m of [
    mockTeamCreate,
    mockTeamUpdate,
    mockTeamDelete,
    mockTeamFindUnique,
    mockMemberCount,
    mockProjectCount,
    mockRoleFindFirst,
    mockTransaction,
    mockCan,
    mockCurrentUserId,
    mockAccessFor,
    mockAssignmentCeiling,
    mockSyncProjectTeamRoles,
  ]) {
    m.mockReset();
  }
  mockAssignmentCeiling.mockReturnValue(Number.POSITIVE_INFINITY);
  for (const group of [mockTx.teamMember, mockTx.teamProject]) {
    for (const fn of Object.values(group)) {
      fn.mockReset();
      fn.mockResolvedValue({});
    }
  }
  // Previous state for sync comparisons: no members/project roles, unless
  // a test specifies otherwise.
  mockTx.teamMember.findMany.mockResolvedValue([]);
  mockTx.teamProject.findMany.mockResolvedValue([]);

  mockCurrentUserId.mockResolvedValue(ACTOR);
  mockCan.mockResolvedValue(true);
  mockTeamCreate.mockResolvedValue({ id: TEAM });
  mockTeamUpdate.mockResolvedValue({ id: TEAM });
  mockTeamDelete.mockResolvedValue({ id: TEAM });
  // No team already has the identifier; on update the team itself is loaded.
  mockTeamFindUnique.mockResolvedValue(null);
  // Lead and member belong to the workspace, and so does the project.
  mockMemberCount.mockResolvedValue(2);
  mockProjectCount.mockResolvedValue(1);
  mockTransaction.mockImplementation(
    async (
      fn: typeof mockTx extends never ? never : (tx: unknown) => unknown,
    ) => fn(mockTx),
  );
}

describe("createTeam()", () => {
  beforeEach(reset);

  it("verlangt team.create im Workspace-Kontext", async () => {
    grants({ "team.create": false });
    expect(await createTeam(WS, input())).toEqual({
      error: "You are not allowed to create teams here.",
    });
    expect(mockCan).toHaveBeenCalledWith(ACTOR, "team.create", {
      workspaceId: WS,
    });
    expect(mockTeamCreate).not.toHaveBeenCalled();
  });

  it("lehnt einen leeren Namen ab", async () => {
    expect(await createTeam(WS, input({ name: "  " }))).toEqual({
      error: "Name is required.",
    });
  });

  it("lehnt ein schon vergebenes Kürzel ab", async () => {
    mockTeamFindUnique.mockResolvedValue({ id: "t-anderes" });
    expect(await createTeam(WS, input())).toEqual({
      error: "Another team in this workspace uses that identifier.",
    });
  });

  it("leitet das Kürzel aus dem Namen ab, wenn keines kommt", async () => {
    await createTeam(WS, input({ key: "" }));
    expect(mockTeamCreate.mock.calls[0][0].data.key).toBe("PLAT");
  });

  // Without this check, foreign ids could be used to assemble a team
  // that reaches across into another tenant.
  it("nimmt nur Mitglieder des Workspace auf", async () => {
    mockMemberCount.mockResolvedValue(1);
    expect(await createTeam(WS, input())).toEqual({
      error: "Only workspace members can be part of a team.",
    });
    expect(mockTeamCreate).not.toHaveBeenCalled();
  });

  it("nimmt nur Projekte des Workspace auf", async () => {
    mockProjectCount.mockResolvedValue(0);
    expect(await createTeam(WS, input())).toEqual({
      error: "Only projects of this workspace can be assigned.",
    });
  });

  it("trägt den Lead als Mitglied ein — ohne ihn doppelt zu führen", async () => {
    expect(
      await createTeam(WS, input({ memberIds: ["u-lead", "u-1"] })),
    ).toEqual({ ok: true });
    const created = mockTeamCreate.mock.calls[0][0].data;
    expect(created.members.create).toEqual([
      { userId: "u-lead" },
      { userId: "u-1" },
    ]);
    expect(created.projects.create).toEqual([
      { projectId: "p-1", roleId: null },
    ]);
  });

  it("verknüpft ein Projekt ohne Rolle, ohne die Team-Rollen zu synchronisieren", async () => {
    expect(await createTeam(WS, input())).toEqual({ ok: true });
    expect(mockSyncProjectTeamRoles).not.toHaveBeenCalled();
  });

  describe("mit einer Rolle je Projekt", () => {
    const withRole = () =>
      input({ projects: [{ projectId: "p-1", roleKey: "contributor" }] });

    it("verlangt member.role.update im betroffenen Projekt", async () => {
      mockAccessFor.mockResolvedValue({ has: () => false });
      expect(await createTeam(WS, withRole())).toEqual({
        error: "You are not allowed to grant project roles through teams here.",
      });
      expect(mockTeamCreate).not.toHaveBeenCalled();
    });

    it("lehnt eine unbekannte Rolle ab", async () => {
      mockAccessFor.mockResolvedValue({ has: () => true });
      mockRoleFindFirst.mockResolvedValue(null);
      expect(await createTeam(WS, withRole())).toEqual({
        error: "Pick a valid role for each project.",
      });
    });

    // Without this check, someone who only holds `team.project.manage` (e.g.
    // the "Manager" role, without any project permission) could use a team to
    // grant access to a project in which they themselves can do nothing.
    it("lehnt eine Rolle über der eigenen Obergrenze im Projekt ab", async () => {
      mockAccessFor.mockResolvedValue({ has: () => true });
      mockAssignmentCeiling.mockReturnValue(2);
      mockRoleFindFirst.mockResolvedValue({ id: "role-admin", rank: 4 });
      expect(await createTeam(WS, withRole())).toEqual({
        error: "You cannot grant a team a role above your own in that project.",
      });
      expect(mockTeamCreate).not.toHaveBeenCalled();
    });

    it("legt die Team-Projektrolle an und synchronisiert die Mitglieder", async () => {
      mockAccessFor.mockResolvedValue({ has: () => true });
      mockRoleFindFirst.mockResolvedValue({ id: "role-contrib", rank: 3 });

      expect(await createTeam(WS, withRole())).toEqual({ ok: true });

      const created = mockTeamCreate.mock.calls[0][0].data;
      expect(created.projects.create).toEqual([
        { projectId: "p-1", roleId: "role-contrib" },
      ]);
      expect(mockSyncProjectTeamRoles).toHaveBeenCalledWith(mockTx, "p-1", [
        "u-lead",
        "u-1",
      ]);
    });
  });
});

describe("updateTeam()", () => {
  // `team.findUnique` is queried twice: once for the team itself (by id)
  // and once to check whether the identifier is already taken (by
  // workspaceId_key). The mock distinguishes between the two — otherwise the
  // second answer would mistake the team's own record for a foreign namesake.
  const onlyOwnTeam = async ({ where }: { where: { id?: string } }) =>
    where.id ? { workspaceId: WS } : null;

  beforeEach(() => {
    reset();
    mockTeamFindUnique.mockImplementation(onlyOwnTeam);
  });

  it("meldet ein Team, das es nicht mehr gibt", async () => {
    mockTeamFindUnique.mockResolvedValue(null);
    expect(await updateTeam(TEAM, input())).toEqual({
      error: "This team no longer exists.",
    });
  });

  it("lehnt ab, wer keines der drei Rechte hat", async () => {
    grants({});
    expect(await updateTeam(TEAM, input())).toEqual({
      error: "You are not allowed to change this team.",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  // The three parts each depend on a separate permission. Whoever holds only
  // one changes only their part — the rest is left alone, not rejected.
  it("ändert nur die Mitglieder, wenn nur team.member.manage vorliegt", async () => {
    grants({ "team.member.manage": true });

    expect(await updateTeam(TEAM, input())).toEqual({ ok: true });
    expect(mockTeamUpdate).not.toHaveBeenCalled();
    expect(mockTx.teamMember.createMany).toHaveBeenCalled();
    expect(mockTx.teamProject.deleteMany).not.toHaveBeenCalled();
  });

  it("ändert nur die Projekte, wenn nur team.project.manage vorliegt", async () => {
    grants({ "team.project.manage": true });

    await updateTeam(TEAM, input());
    expect(mockTeamUpdate).not.toHaveBeenCalled();
    expect(mockTx.teamMember.deleteMany).not.toHaveBeenCalled();
    expect(mockTx.teamProject.createMany).toHaveBeenCalledWith({
      data: [{ teamId: TEAM, projectId: "p-1", roleId: null }],
    });
  });

  it("setzt Mitglieder und Projekte als Ganzes neu", async () => {
    await updateTeam(TEAM, input());
    expect(mockTx.teamMember.deleteMany).toHaveBeenCalledWith({
      where: { teamId: TEAM },
    });
    expect(mockTx.teamMember.createMany).toHaveBeenCalledWith({
      data: [
        { teamId: TEAM, userId: "u-lead" },
        { teamId: TEAM, userId: "u-1" },
      ],
    });
  });

  it("lässt das eigene Kürzel stehen", async () => {
    mockTeamFindUnique.mockImplementation(
      async ({ where }: { where: { id?: string } }) =>
        where.id ? { workspaceId: WS } : { id: TEAM },
    );
    expect(await updateTeam(TEAM, input())).toEqual({ ok: true });
  });

  it("synchronisiert Team-Rollen für alte und neue Mitglieder eines weiter verknüpften Projekts", async () => {
    mockAccessFor.mockResolvedValue({ has: () => true });
    mockRoleFindFirst.mockResolvedValue({ id: "role-contrib", rank: 3 });
    // Before: u-2 was a member, project p-1 already carried a role.
    mockTx.teamMember.findMany.mockResolvedValue([{ userId: "u-2" }]);
    mockTx.teamProject.findMany.mockResolvedValue([{ projectId: "p-1" }]);

    await updateTeam(
      TEAM,
      input({
        memberIds: ["u-1"],
        projects: [{ projectId: "p-1", roleKey: "contributor" }],
      }),
    );

    expect(mockSyncProjectTeamRoles).toHaveBeenCalledWith(
      mockTx,
      "p-1",
      expect.arrayContaining(["u-lead", "u-1", "u-2"]),
    );
  });

  it("synchronisiert auch das Projekt, das gerade seine Rolle verliert", async () => {
    // Before, p-1 carried a role; now the link is removed entirely.
    mockTx.teamProject.findMany.mockResolvedValue([{ projectId: "p-1" }]);

    await updateTeam(TEAM, input({ projects: [] }));

    expect(mockSyncProjectTeamRoles).toHaveBeenCalledWith(
      mockTx,
      "p-1",
      expect.any(Array),
    );
  });
});

describe("deleteTeam()", () => {
  beforeEach(() => {
    reset();
    mockTeamFindUnique.mockResolvedValue({ workspaceId: WS });
  });

  it("verlangt team.delete", async () => {
    grants({ "team.delete": false });
    expect(await deleteTeam(TEAM)).toEqual({
      error: "You are not allowed to delete this team.",
    });
    expect(mockTeamDelete).not.toHaveBeenCalled();
  });

  it("löscht das Team", async () => {
    expect(await deleteTeam(TEAM)).toEqual({ ok: true });
    expect(mockTeamDelete).toHaveBeenCalledWith({ where: { id: TEAM } });
  });

  it("synchronisiert Team-Rollen für jedes Projekt, das eine Rolle trug", async () => {
    mockTx.teamMember.findMany.mockResolvedValue([
      { userId: "u-1" },
      { userId: "u-2" },
    ]);
    mockTx.teamProject.findMany.mockResolvedValue([{ projectId: "p-1" }]);

    await deleteTeam(TEAM);

    expect(mockSyncProjectTeamRoles).toHaveBeenCalledWith(mockTx, "p-1", [
      "u-1",
      "u-2",
    ]);
  });

  it("synchronisiert nichts, wenn kein Projekt eine Rolle trug", async () => {
    mockTx.teamProject.findMany.mockResolvedValue([]);
    await deleteTeam(TEAM);
    expect(mockSyncProjectTeamRoles).not.toHaveBeenCalled();
  });
});
