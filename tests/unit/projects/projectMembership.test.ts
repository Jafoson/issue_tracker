import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  dropProjectMemberships,
  enrollInWorkspaceProjects,
  enrollWorkspaceMembers,
  projectRoleKeyFor,
} from "@/lib/project-membership";

// Die Helfer bekommen ihren Client als Argument — hier genügt ein Doppel mit
// genau den Methoden, die sie anfassen.

const workspaceMemberFindMany = mock();
const workspaceMemberFindUnique = mock();
const projectFindMany = mock();
const projectMemberCreateMany = mock();
const projectMemberDeleteMany = mock();

const fake = {
  workspaceMember: {
    findMany: workspaceMemberFindMany,
    findUnique: workspaceMemberFindUnique,
  },
  project: { findMany: projectFindMany },
  projectMember: {
    createMany: projectMemberCreateMany,
    deleteMany: projectMemberDeleteMany,
  },
};

type Db = Parameters<typeof enrollWorkspaceMembers>[0];
const db = fake as unknown as Db;

const WS = "acme";

/** Rollen-Einträge, wie die Datenbank sie liefert. */
const allow = (...keys: string[]) =>
  keys.map((permissionKey) => ({ permissionKey, effect: "ALLOW" }));

const role = (...keys: string[]) => ({ permissions: allow(...keys) });

beforeEach(() => {
  for (const m of [
    workspaceMemberFindMany,
    workspaceMemberFindUnique,
    projectFindMany,
    projectMemberCreateMany,
    projectMemberDeleteMany,
  ]) {
    m.mockReset();
    m.mockResolvedValue({});
  }
  workspaceMemberFindMany.mockResolvedValue([
    { userId: "u-owner", role: role("member.invite", "project.view.all") },
    { userId: "u-member", role: role("project.view", "issue.create") },
  ]);
  workspaceMemberFindUnique.mockResolvedValue({
    role: role("project.view", "issue.create"),
  });
  projectFindMany.mockResolvedValue([{ id: "p-1" }, { id: "p-2" }]);
});

describe("projectRoleKeyFor()", () => {
  it("macht aus der Workspace-Leitung einen Project Admin", () => {
    expect(projectRoleKeyFor(allow("project.view.all"))).toBe("project_admin");
    expect(projectRoleKeyFor(allow("member.invite"))).toBe("project_admin");
  });

  it("macht aus einem Mitglied einen Contributor", () => {
    expect(projectRoleKeyFor(allow("project.view", "issue.create"))).toBe(
      "contributor",
    );
  });

  it("macht aus einem Leser einen Viewer", () => {
    expect(projectRoleKeyFor(allow("project.view", "comment.create"))).toBe(
      "project_viewer",
    );
  });

  it("sperrt, wer auch vorher kein Projekt sehen durfte", () => {
    expect(projectRoleKeyFor(allow("workspace.update"))).toBe("blocked");
    expect(projectRoleKeyFor([])).toBe("blocked");
  });

  it("achtet auf DENY — ein verbotenes Recht zählt nicht", () => {
    const grants = [
      ...allow("project.view", "issue.create"),
      { permissionKey: "issue.create", effect: "DENY" },
    ];
    expect(projectRoleKeyFor(grants)).toBe("project_viewer");
  });
});

describe("enrollWorkspaceMembers()", () => {
  it("trägt jedes Workspace-Mitglied mit passender Projektrolle ein", async () => {
    await enrollWorkspaceMembers(db, { id: "p-1", workspaceId: WS });

    expect(projectMemberCreateMany).toHaveBeenCalledWith({
      data: [
        {
          projectId: "p-1",
          userId: "u-owner",
          roleId: "sys:PROJECT:project_admin",
        },
        {
          projectId: "p-1",
          userId: "u-member",
          roleId: "sys:PROJECT:contributor",
        },
      ],
      skipDuplicates: true,
    });
  });

  it("lässt eine bestehende Projektrolle unangetastet", async () => {
    await enrollWorkspaceMembers(db, { id: "p-1", workspaceId: WS });
    expect(projectMemberCreateMany.mock.calls[0][0].skipDuplicates).toBe(true);
  });

  it("schreibt nichts, wenn der Workspace leer ist", async () => {
    workspaceMemberFindMany.mockResolvedValue([]);
    await enrollWorkspaceMembers(db, { id: "p-1", workspaceId: WS });
    expect(projectMemberCreateMany).not.toHaveBeenCalled();
  });
});

describe("enrollInWorkspaceProjects()", () => {
  it("trägt die Person in jedes öffentliche Projekt ein", async () => {
    await enrollInWorkspaceProjects(db, { workspaceId: WS, userId: "u-9" });

    expect(projectFindMany).toHaveBeenCalledWith({
      where: { workspaceId: WS, visibility: "public" },
      select: { id: true },
    });
    expect(projectMemberCreateMany).toHaveBeenCalledWith({
      data: [
        { projectId: "p-1", userId: "u-9", roleId: "sys:PROJECT:contributor" },
        { projectId: "p-2", userId: "u-9", roleId: "sys:PROJECT:contributor" },
      ],
      skipDuplicates: true,
    });
  });

  it("lässt private Projekte aus — dort zählt nur eine Aufnahme", async () => {
    await enrollInWorkspaceProjects(db, { workspaceId: WS, userId: "u-9" });
    expect(projectFindMany.mock.calls[0][0].where.visibility).toBe("public");
  });

  it("schreibt nichts ohne Workspace-Mitgliedschaft", async () => {
    workspaceMemberFindUnique.mockResolvedValue(null);
    await enrollInWorkspaceProjects(db, { workspaceId: WS, userId: "u-9" });
    expect(projectMemberCreateMany).not.toHaveBeenCalled();
  });

  it("schreibt nichts, wenn der Workspace keine Projekte hat", async () => {
    projectFindMany.mockResolvedValue([]);
    await enrollInWorkspaceProjects(db, { workspaceId: WS, userId: "u-9" });
    expect(projectMemberCreateMany).not.toHaveBeenCalled();
  });
});

describe("dropProjectMemberships()", () => {
  it("löscht alle Projektmitgliedschaften dieses Workspace", async () => {
    await dropProjectMemberships(db, { workspaceId: WS, userId: "u-9" });

    expect(projectMemberDeleteMany).toHaveBeenCalledWith({
      where: { userId: "u-9", project: { workspaceId: WS } },
    });
  });
});
