import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockTeamCreate = mock();
const mockTeamUpdate = mock();
const mockTeamDelete = mock();
const mockTeamFindUnique = mock();
const mockMemberCount = mock();
const mockProjectCount = mock();
const mockTransaction = mock();

const mockTx = {
  team: { update: mockTeamUpdate },
  teamMember: { deleteMany: mock(), createMany: mock() },
  teamProject: { deleteMany: mock(), createMany: mock() },
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
    $transaction: mockTransaction,
  },
}));

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
  projectIds: ["p-1"],
  ...over,
});

/** Welche der drei Team-Permissions der Handelnde hat. */
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
    mockTransaction,
    mockCan,
    mockCurrentUserId,
  ]) {
    m.mockReset();
  }
  for (const group of [mockTx.teamMember, mockTx.teamProject]) {
    for (const fn of Object.values(group)) {
      fn.mockReset();
      fn.mockResolvedValue({});
    }
  }

  mockCurrentUserId.mockResolvedValue(ACTOR);
  mockCan.mockResolvedValue(true);
  mockTeamCreate.mockResolvedValue({ id: TEAM });
  mockTeamUpdate.mockResolvedValue({ id: TEAM });
  mockTeamDelete.mockResolvedValue({ id: TEAM });
  // Kein Team trägt das Kürzel schon; beim Ändern wird das Team selbst geladen.
  mockTeamFindUnique.mockResolvedValue(null);
  // Lead und Mitglied gehören zum Workspace, das Projekt auch.
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

  // Ohne diese Prüfung ließe sich über fremde Ids ein Team zusammenstellen,
  // das quer durch einen anderen Mandanten reicht.
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
    expect(created.projects.create).toEqual([{ projectId: "p-1" }]);
  });
});

describe("updateTeam()", () => {
  // `team.findUnique` wird zweimal gefragt: einmal nach dem Team selbst (per
  // Id) und einmal danach, ob das Kürzel schon vergeben ist (per
  // workspaceId_key). Der Mock unterscheidet beides — sonst hielte die zweite
  // Antwort das eigene Team für einen fremden Namensvetter.
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

  // Die drei Teile hängen an drei Rechten. Wer nur eines hat, ändert nur
  // seinen Teil — der Rest wird übergangen, nicht abgelehnt.
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
      data: [{ teamId: TEAM, projectId: "p-1" }],
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
});
