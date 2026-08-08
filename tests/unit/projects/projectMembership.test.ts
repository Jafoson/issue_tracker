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
  keys.map((permissionKey) => ({ permissionKey }));

/**
 * Eine Workspace-Rolle, wie die Ableitung sie sieht. Der Key entscheidet bei den
 * System-Rollen, die Einträge nur bei selbst angelegten.
 */
const role = (key: string, ...keys: string[]) => ({
  key,
  permissions: allow(...keys),
});

/** Eine selbst angelegte Rolle — ihr Key steht in keiner Registry. */
const custom = (...keys: string[]) => role("eigene-rolle", ...keys);

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
    { userId: "u-owner", role: role("owner") },
    { userId: "u-member", role: role("member") },
  ]);
  workspaceMemberFindUnique.mockResolvedValue({ role: role("member") });
  projectFindMany.mockResolvedValue([{ id: "p-1" }, { id: "p-2" }]);
});

describe("projectRoleKeyFor()", () => {
  // Bei den System-Rollen steht die Zuordnung ausdrücklich in lib/rbac/roles.ts.
  // Sie zu erraten ginge nicht mehr: eine Workspace-Rolle sagt seit der Trennung
  // der Ebenen nichts mehr darüber, was jemand in einem Projekt darf.
  it("folgt bei System-Rollen der erklärten Zuordnung", () => {
    expect(projectRoleKeyFor(role("owner"))).toBe("project_admin");
    expect(projectRoleKeyFor(role("admin"))).toBe("project_admin");
    expect(projectRoleKeyFor(role("project_lead"))).toBe("project_admin");
    expect(projectRoleKeyFor(role("member"))).toBe("contributor");
    expect(projectRoleKeyFor(role("viewer"))).toBe("project_viewer");
    expect(projectRoleKeyFor(role("guest"))).toBe("project_viewer");
  });

  it("übergeht bei System-Rollen die Einträge", () => {
    // Der Key gewinnt: eine System-Rolle ist überall dieselbe Zeile, ihre
    // Zuordnung soll nicht davon abhängen, was gerade in der Tabelle steht.
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
    // Nie `blocked`: einen Ausschluss spricht man aus, er ist kein Nebenprodukt
    // einer schwachen Rolle.
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
