import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  dropProjectMemberships,
  enrollInWorkspaceProjects,
  enrollWorkspaceMembers,
  projectRoleKeyFor,
  syncProjectTeamRoles,
} from "@/lib/project-membership";

// The helpers receive their client as an argument — a double with exactly
// the methods they touch is enough here.

const workspaceMemberFindMany = mock();
const workspaceMemberFindUnique = mock();
const projectFindMany = mock();
const projectMemberCreateMany = mock();
const projectMemberDeleteMany = mock();
const projectMemberFindMany = mock();
const projectMemberUpsert = mock();
const teamProjectFindMany = mock();

const fake = {
  workspaceMember: {
    findMany: workspaceMemberFindMany,
    findUnique: workspaceMemberFindUnique,
  },
  project: { findMany: projectFindMany },
  projectMember: {
    createMany: projectMemberCreateMany,
    deleteMany: projectMemberDeleteMany,
    findMany: projectMemberFindMany,
    upsert: projectMemberUpsert,
  },
  teamProject: { findMany: teamProjectFindMany },
};

type Db = Parameters<typeof enrollWorkspaceMembers>[0];
const db = fake as unknown as Db;

const WS = "acme";

/** Role entries, as the database returns them. */
const allow = (...keys: string[]) =>
  keys.map((permissionKey) => ({ permissionKey }));

/**
 * A workspace role, as the derivation sees it. For system roles the key
 * decides; for custom roles only the entries do.
 */
const role = (key: string, ...keys: string[]) => ({
  key,
  permissions: allow(...keys),
});

/** A custom role — its key appears in no registry. */
const custom = (...keys: string[]) => role("eigene-rolle", ...keys);

beforeEach(() => {
  for (const m of [
    workspaceMemberFindMany,
    workspaceMemberFindUnique,
    projectFindMany,
    projectMemberCreateMany,
    projectMemberDeleteMany,
    projectMemberFindMany,
    projectMemberUpsert,
    teamProjectFindMany,
  ]) {
    m.mockReset();
    m.mockResolvedValue({});
  }
  workspaceMemberFindMany.mockResolvedValue([
    { userId: "u-owner", role: role("owner") },
    { userId: "u-member", role: role("member") },
  ]);
  workspaceMemberFindUnique.mockResolvedValue({ role: role("member") });
  projectFindMany.mockResolvedValue([{ id: "p-1" }, { id: "p-2" }]);
  projectMemberFindMany.mockResolvedValue([]);
  teamProjectFindMany.mockResolvedValue([]);
});

describe("projectRoleKeyFor()", () => {
  // For system roles the mapping is stated explicitly in lib/rbac/roles.ts.
  // It can no longer be guessed: since the levels were separated, a workspace
  // role no longer says anything about what someone may do in a project.
  it("folgt bei System-Rollen der erklärten Zuordnung", () => {
    expect(projectRoleKeyFor(role("owner"))).toBe("project_admin");
    expect(projectRoleKeyFor(role("admin"))).toBe("project_admin");
    expect(projectRoleKeyFor(role("project_lead"))).toBe("project_admin");
    expect(projectRoleKeyFor(role("member"))).toBe("contributor");
    expect(projectRoleKeyFor(role("viewer"))).toBe("project_viewer");
    expect(projectRoleKeyFor(role("guest"))).toBe("project_viewer");
  });

  it("übergeht bei System-Rollen die Einträge", () => {
    // The key wins: a system role is the same row everywhere, and its
    // mapping should not depend on whatever happens to be in the table.
    expect(projectRoleKeyFor(role("viewer", "project.admin.all"))).toBe(
      "project_viewer",
    );
  });

  it("macht aus einer eigenen Rolle mit Durchgriff einen Project Admin", () => {
    expect(projectRoleKeyFor(custom("project.admin.all"))).toBe(
      "project_admin",
    );
  });

  it("macht aus einer eigenen Rolle, die etwas anlegen darf, einen Contributor", () => {
    expect(projectRoleKeyFor(custom("project.create"))).toBe("contributor");
    expect(projectRoleKeyFor(custom("label.create"))).toBe("contributor");
  });

  it("macht aus jeder anderen eigenen Rolle einen Leser", () => {
    // Never `blocked`: an exclusion is stated explicitly, it is not a
    // byproduct of a weak role.
    expect(projectRoleKeyFor(custom("workspace.update"))).toBe(
      "project_viewer",
    );
    expect(projectRoleKeyFor(custom())).toBe("project_viewer");
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

describe("syncProjectTeamRoles()", () => {
  const PROJECT = "p-1";

  /** A team-project link with a role, as the database returns it. */
  const grant = (
    teamId: string,
    roleId: string,
    rank: number,
    userIds: string[],
  ) => ({
    teamId,
    roleId,
    role: { rank },
    team: { members: userIds.map((userId) => ({ userId })) },
  });

  it("fragt nichts ab, wenn keine Personen betroffen sind", async () => {
    await syncProjectTeamRoles(db, PROJECT, []);
    expect(teamProjectFindMany).not.toHaveBeenCalled();
    expect(projectMemberFindMany).not.toHaveBeenCalled();
  });

  it("übernimmt die Team-Rolle für ein neues Mitglied", async () => {
    teamProjectFindMany.mockResolvedValue([
      grant("t-1", "role-contrib", 3, ["u-1"]),
    ]);

    await syncProjectTeamRoles(db, PROJECT, ["u-1"]);

    expect(projectMemberUpsert).toHaveBeenCalledWith({
      where: { projectId_userId: { projectId: PROJECT, userId: "u-1" } },
      update: { roleId: "role-contrib", origin: "team", originTeamId: "t-1" },
      create: {
        projectId: PROJECT,
        userId: "u-1",
        roleId: "role-contrib",
        origin: "team",
        originTeamId: "t-1",
      },
    });
  });

  // Two teams on the same project, the same person in both — the higher
  // rank wins, exactly how `assignmentCeiling` compares ranks elsewhere too.
  it("wählt bei mehreren Teams die ranghöchste Rolle", async () => {
    teamProjectFindMany.mockResolvedValue([
      grant("t-viewer", "role-viewer", 2, ["u-1"]),
      grant("t-admin", "role-admin", 4, ["u-1"]),
    ]);

    await syncProjectTeamRoles(db, PROJECT, ["u-1"]);

    expect(projectMemberUpsert).toHaveBeenCalledTimes(1);
    expect(projectMemberUpsert.mock.calls[0][0].update).toEqual({
      roleId: "role-admin",
      origin: "team",
      originTeamId: "t-admin",
    });
  });

  // The promise made to the project lead: a role they set manually is never
  // touched by the team sync — neither updated nor deleted.
  it("fasst eine manuell gesetzte Zeile nicht an", async () => {
    projectMemberFindMany.mockResolvedValue([
      { userId: "u-1", origin: "manual" },
    ]);
    teamProjectFindMany.mockResolvedValue([
      grant("t-1", "role-contrib", 3, ["u-1"]),
    ]);

    await syncProjectTeamRoles(db, PROJECT, ["u-1"]);

    expect(projectMemberUpsert).not.toHaveBeenCalled();
    expect(projectMemberDeleteMany).not.toHaveBeenCalled();
  });

  it("löscht eine Team-Zeile, wenn kein Team mehr eine Rolle trägt", async () => {
    projectMemberFindMany.mockResolvedValue([
      { userId: "u-1", origin: "team" },
    ]);
    teamProjectFindMany.mockResolvedValue([]);

    await syncProjectTeamRoles(db, PROJECT, ["u-1"]);

    expect(projectMemberDeleteMany).toHaveBeenCalledWith({
      where: { projectId: PROJECT, userId: { in: ["u-1"] } },
    });
    expect(projectMemberUpsert).not.toHaveBeenCalled();
  });

  it("lässt eine manuelle Zeile ohne Team-Deckung unangetastet", async () => {
    projectMemberFindMany.mockResolvedValue([
      { userId: "u-1", origin: "manual" },
    ]);
    teamProjectFindMany.mockResolvedValue([]);

    await syncProjectTeamRoles(db, PROJECT, ["u-1"]);

    expect(projectMemberDeleteMany).not.toHaveBeenCalled();
    expect(projectMemberUpsert).not.toHaveBeenCalled();
  });
});
