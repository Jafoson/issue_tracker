import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────
//
// A single question is being checked here: who does a role's carrier count
// count? It depends on the pot you're standing in, and a wrong slice goes
// unnoticed by anyone — the number always looks plausible.

const mockRoleFindMany = mock();
const mockWorkspaceGroupBy = mock();
const mockProjectGroupBy = mock();

mock.module("@/lib/db", () => ({
  db: {
    role: { findMany: mockRoleFindMany },
    workspaceMember: { groupBy: mockWorkspaceGroupBy },
    projectMember: { groupBy: mockProjectGroupBy },
  },
}));

const mockAccessFor = mock();
const mockCurrentUserId = mock<() => Promise<string | null>>();

mock.module("@/lib/permissions", () => ({
  PLATFORM: { scope: "platform" },
  accessFor: mockAccessFor,
  currentUserId: mockCurrentUserId,
  assignmentCeiling: () => Number.POSITIVE_INFINITY,
}));

import { getRoleManagerView } from "@/features/roles/queries";
import type { RoleTarget } from "@/features/roles/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** A role row as `findMany` returns it — eight carriers total across the board. */
function roleRow(id: string) {
  return {
    id,
    key: "custom",
    name: "Custom",
    desc: "",
    rank: 2,
    system: false,
    editable: true,
    workspaceId: "ws1",
    projectId: null,
    permissions: [],
    _count: { workspaceMembers: 5, projectMembers: 3, platformUsers: 0 },
  };
}

const count = (roleId: string, n: number) => ({
  roleId,
  _count: { _all: n },
});

beforeEach(() => {
  mock.clearAllMocks();
  mockCurrentUserId.mockResolvedValue("u1");
  mockAccessFor.mockResolvedValue({
    has: () => true,
    rank: () => 9,
    roleKey: () => "admin",
  });
  mockRoleFindMany.mockResolvedValue([roleRow("ws:ws1:custom")]);
  mockWorkspaceGroupBy.mockResolvedValue([]);
  mockProjectGroupBy.mockResolvedValue([]);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Trägerzahl je Topf", () => {
  it("zählt im Workspace nur dessen Mitglieder", async () => {
    mockWorkspaceGroupBy.mockResolvedValue([count("ws:ws1:custom", 2)]);

    const view = await getRoleManagerView({
      scope: "WORKSPACE",
      workspaceId: "ws1",
    });

    expect(mockWorkspaceGroupBy).toHaveBeenCalledWith({
      by: ["roleId"],
      where: { workspaceId: "ws1" },
      _count: { _all: true },
    });
    expect(mockProjectGroupBy).not.toHaveBeenCalled();
    expect(view.roles[0].memberCount).toBe(2);
  });

  it("zählt im Projekt nur dessen Mitglieder", async () => {
    mockProjectGroupBy.mockResolvedValue([count("ws:ws1:custom", 1)]);

    const target: RoleTarget = {
      scope: "PROJECT",
      workspaceId: "ws1",
      projectId: "p1",
    };
    const view = await getRoleManagerView(target);

    expect(mockProjectGroupBy).toHaveBeenCalledWith({
      by: ["roleId"],
      where: { projectId: "p1" },
      _count: { _all: true },
    });
    expect(view.roles[0].memberCount).toBe(1);
  });

  it("zählt bei den Projektrollen des Workspace über alle seine Projekte", async () => {
    // This pot applies in every project — a single one would be the wrong
    // slice.
    mockProjectGroupBy.mockResolvedValue([count("ws:ws1:custom", 7)]);

    const view = await getRoleManagerView({
      scope: "PROJECT",
      workspaceId: "ws1",
      projectId: null,
    });

    expect(mockProjectGroupBy).toHaveBeenCalledWith({
      by: ["roleId"],
      where: { project: { workspaceId: "ws1" } },
      _count: { _all: true },
    });
    expect(view.roles[0].memberCount).toBe(7);
  });

  it("meldet null, wenn die Rolle hier von niemandem getragen wird", async () => {
    // The shared default role has carriers elsewhere — not here.
    mockProjectGroupBy.mockResolvedValue([count("sys:PROJECT:member", 4)]);

    const view = await getRoleManagerView({
      scope: "PROJECT",
      workspaceId: "ws1",
      projectId: "p1",
    });

    expect(view.roles[0].memberCount).toBe(0);
    // Deleting stays blocked all the same: the foreign key doesn't know about pots.
    expect(view.roles[0].totalCarriers).toBe(8);
  });

  it("nimmt auf der Plattform den globalen Zähler", async () => {
    mockRoleFindMany.mockResolvedValue([
      {
        ...roleRow("plat:support"),
        _count: { workspaceMembers: 0, projectMembers: 0, platformUsers: 3 },
      },
    ]);

    const view = await getRoleManagerView({ scope: "PLATFORM" });

    // The pot *is* the platform — there's no narrower slice and therefore no
    // second query either.
    expect(mockWorkspaceGroupBy).not.toHaveBeenCalled();
    expect(mockProjectGroupBy).not.toHaveBeenCalled();
    expect(view.roles[0].memberCount).toBe(3);
  });
});
