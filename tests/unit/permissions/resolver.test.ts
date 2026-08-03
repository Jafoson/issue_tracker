import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUserFindUnique = mock();
const mockWorkspaceFindUnique = mock();
const mockWorkspaceMemberFindUnique = mock();
const mockProjectFindUnique = mock();
const mockProjectMemberFindUnique = mock();
const mockProjectFindMany = mock();
const mockProjectMemberFindMany = mock();

mock.module("@/lib/db", () => ({
  db: {
    user: { findUnique: mockUserFindUnique },
    workspace: { findUnique: mockWorkspaceFindUnique },
    workspaceMember: { findUnique: mockWorkspaceMemberFindUnique },
    project: {
      findUnique: mockProjectFindUnique,
      findMany: mockProjectFindMany,
    },
    projectMember: {
      findUnique: mockProjectMemberFindUnique,
      findMany: mockProjectMemberFindMany,
    },
  },
}));

const mockGetSession = mock(async () => ({ userId: "u1" }));
mock.module("@/lib/session", () => ({ getSession: mockGetSession }));

// `cache()` dedupliziert pro Request. Im Test wollen wir jeden Aufruf sehen,
// sonst würden Fälle innerhalb einer Datei einander die Antworten überschreiben.
mock.module("react", () => ({
  cache: <T>(fn: T) => fn,
}));

import {
  accessFor,
  accessibleProjectIds,
  assignmentCeiling,
  can,
} from "@/lib/permissions";

// ── Helfer ────────────────────────────────────────────────────────────────────

type Grant = [string, "ALLOW" | "DENY"];

function role(key: string, rank: number, grants: Grant[]) {
  return {
    key,
    rank,
    permissions: grants.map(([permissionKey, effect]) => ({
      permissionKey,
      effect,
    })),
  };
}

const allow = (...keys: string[]): Grant[] =>
  keys.map((k) => [k, "ALLOW"] as Grant);

/** Standardaufbau: kein globales Recht, ein offener Workspace, ein öffentliches Projekt. */
function setup(
  opts: {
    platform?: ReturnType<typeof role> | null;
    workspace?: ReturnType<typeof role> | null;
    project?: ReturnType<typeof role> | null;
    pending?: boolean;
    suspended?: boolean;
    visibility?: string;
  } = {},
) {
  mockUserFindUnique.mockResolvedValue({
    platformRole: opts.platform ?? null,
  });
  mockWorkspaceFindUnique.mockResolvedValue({
    suspended: opts.suspended ?? false,
  });
  mockWorkspaceMemberFindUnique.mockResolvedValue(
    opts.workspace
      ? { pending: opts.pending ?? false, role: opts.workspace }
      : null,
  );
  mockProjectFindUnique.mockResolvedValue({
    workspaceId: "ws1",
    visibility: opts.visibility ?? "public",
  });
  mockProjectMemberFindUnique.mockResolvedValue(
    opts.project ? { role: opts.project } : null,
  );
}

beforeEach(() => {
  mock.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Vereinigung über die Ebenen", () => {
  it("addiert Workspace- und Projektrechte", async () => {
    setup({
      workspace: role("member", 2, allow("project.view")),
      project: role("contributor", 3, allow("issue.create")),
    });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(true);
    expect(access.has("issue.create")).toBe(true);
  });

  it("gewährt ohne jede Rolle nichts", async () => {
    setup();
    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(false);
  });

  it("gewährt ohne Session nichts", async () => {
    setup({ workspace: role("owner", 6, allow("project.view")) });
    const access = await accessFor(null, { projectId: "p1" });
    expect(access.has("project.view")).toBe(false);
  });

  it("merkt sich Rolle und Rang je Ebene", async () => {
    setup({
      workspace: role("admin", 5, allow("project.view")),
      project: role("project_viewer", 2, []),
    });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.roleKey("WORKSPACE")).toBe("admin");
    expect(access.rank("WORKSPACE")).toBe(5);
    expect(access.roleKey("PROJECT")).toBe("project_viewer");
    expect(access.rank("PROJECT")).toBe(2);
    expect(access.rank("PLATFORM")).toBe(-1);
  });
});

describe("DENY sticht", () => {
  it("nimmt der Projektrolle weg, was die Workspace-Rolle gibt", async () => {
    // Genau der Fall aus der Praxis: ein project_lead wird in diesem einen
    // Projekt zum Leser herabgestuft.
    setup({
      workspace: role(
        "project_lead",
        3,
        allow("project.view", "issue.update.any"),
      ),
      project: role("project_viewer", 2, [
        ["project.view", "ALLOW"],
        ["issue.update.any", "DENY"],
      ]),
    });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(true);
    expect(access.has("issue.update.any")).toBe(false);
  });

  it("wirkt unabhängig von der Reihenfolge der Ebenen", async () => {
    // Verbot auf der Workspace-Ebene, Erlaubnis auf der Projekt-Ebene.
    setup({
      workspace: role("restricted", 1, [["issue.delete.any", "DENY"]]),
      project: role("project_admin", 4, allow("issue.delete.any")),
    });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("issue.delete.any")).toBe(false);
  });
});

describe("Plattform-Scope und tenant.access", () => {
  it("gibt einer Plattform-Rolle ohne tenant.access keinen Mandanten-Zugriff", async () => {
    // Die Registry lässt Mandanten-Permissions im Scope PLATFORM gar nicht zu —
    // es gibt also keinen Weg, sich das über eine Plattform-Rolle zu erschleichen.
    setup({ platform: role("platform_admin", 2, allow("platform.access")) });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("issue.update.any")).toBe(false);
    expect(access.has("project.view")).toBe(false);
  });

  it("lässt Plattform-Rechte im Mandanten-Kontext bestehen", async () => {
    setup({ platform: role("platform_admin", 2, allow("platform.access")) });

    const access = await accessFor("u1", { workspaceId: "ws1" });
    expect(access.has("platform.access")).toBe(true);
  });

  it("stört die Workspace-Rechte des Benutzers nicht", async () => {
    setup({
      platform: role("platform_member", 0, []),
      workspace: role("member", 2, allow("project.view")),
    });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(true);
  });

  it("öffnet mit tenant.access alles im Mandanten", async () => {
    // Der Generalschlüssel: `tenant.access` kann nur in einer Plattform-Rolle
    // stehen und gilt dann für den ganzen Mandanten.
    setup({
      platform: role(
        "platform_support",
        1,
        allow("platform.access", "tenant.access"),
      ),
    });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(true);
    expect(access.has("issue.update.any")).toBe(true);
  });

  it("gibt mit tenant.access im Workspace-Kontext die Workspace-Rechte", async () => {
    setup({ platform: role("platform_support", 1, allow("tenant.access")) });

    const access = await accessFor("u1", { workspaceId: "ws1" });
    expect(access.has("member.invite")).toBe(true);
    // Aber nichts, was es im Workspace gar nicht gibt.
    expect(access.has("user.manage")).toBe(false);
  });
});

describe("Gesperrter Workspace und offene Einladung", () => {
  it("nimmt in einem gesperrten Workspace alle Mandanten-Rechte", async () => {
    setup({
      workspace: role("owner", 6, allow("project.view", "workspace.delete")),
      suspended: true,
    });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(false);
    // `workspace.delete` ist auch im Scope PLATFORM vergebbar — hier kam es
    // aber aus der Workspace-Rolle und muss deshalb ebenfalls verschwinden.
    expect(access.has("workspace.delete")).toBe(false);
  });

  it("lässt Plattform-Rechte im gesperrten Workspace bestehen", async () => {
    setup({
      platform: role("platform_admin", 2, allow("workspace.suspend")),
      workspace: role("owner", 6, allow("project.view")),
      suspended: true,
    });

    const access = await accessFor("u1", { workspaceId: "ws1" });
    expect(access.has("workspace.suspend")).toBe(true);
    expect(access.has("project.view")).toBe(false);
  });

  it("gibt einer offenen Einladung noch keine Rechte", async () => {
    setup({
      workspace: role("member", 2, allow("project.view")),
      pending: true,
    });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(false);
  });

  it("nimmt Support davon aus", async () => {
    setup({
      platform: role(
        "platform_support",
        1,
        allow("tenant.access", "project.view"),
      ),
      suspended: true,
    });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(true);
  });
});

describe("Private Projekte", () => {
  it("sperrt ein privates Projekt ohne Mitgliedschaft", async () => {
    setup({
      workspace: role("member", 2, allow("project.view", "audit.view")),
      visibility: "private",
    });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(false);
    // Nur die Projekt-Permissions fallen weg, die Workspace-Ebene bleibt.
    expect(access.has("audit.view")).toBe(true);
  });

  it("öffnet es mit workspace.project.view.all", async () => {
    setup({
      workspace: role("admin", 5, allow("project.view", "project.view.all")),
      visibility: "private",
    });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(true);
  });

  it("öffnet es mit einem eigenen Projekteintrag", async () => {
    setup({
      workspace: role("member", 2, []),
      project: role("contributor", 3, allow("project.view")),
      visibility: "private",
    });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(true);
  });

  it("lässt öffentliche Projekte unberührt", async () => {
    setup({ workspace: role("member", 2, allow("project.view")) });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(true);
  });
});

describe("can()", () => {
  it("antwortet false statt zu werfen", async () => {
    setup();
    expect(await can("u1", "project.view", { projectId: "p1" })).toBe(false);
  });

  it("meldet ein unbekanntes Projekt als kein Zugriff", async () => {
    setup();
    mockProjectFindUnique.mockResolvedValue(null);
    expect(await can("u1", "project.view", { projectId: "weg" })).toBe(false);
  });
});

describe("assignmentCeiling", () => {
  it("begrenzt auf den eigenen Rang der Ebene", async () => {
    setup({ project: role("project_admin", 4, []) });
    const access = await accessFor("u1", { projectId: "p1" });
    expect(assignmentCeiling(access, "PROJECT")).toBe(4);
  });

  it("ist nach oben offen, wo der Handelnde keine Rolle trägt", async () => {
    // Ein Workspace-Admin ohne eigene Projektrolle leitet seine Befugnis aus
    // der Ebene darüber ab und darf jede Projektrolle vergeben.
    setup({ workspace: role("admin", 5, allow("member.invite")) });
    const access = await accessFor("u1", { projectId: "p1" });
    expect(assignmentCeiling(access, "PROJECT")).toBe(Number.POSITIVE_INFINITY);
    expect(assignmentCeiling(access, "WORKSPACE")).toBe(5);
  });
});

describe("accessibleProjectIds", () => {
  it("filtert private Projekte ohne Mitgliedschaft heraus", async () => {
    setup({ workspace: role("member", 2, allow("project.view")) });
    mockProjectFindMany.mockResolvedValue([
      { id: "p1", visibility: "public" },
      { id: "p2", visibility: "private" },
    ]);
    mockProjectMemberFindMany.mockResolvedValue([]);

    const visible = await accessibleProjectIds("u1", "ws1");
    expect([...visible]).toEqual(["p1"]);
  });

  it("nimmt private Projekte mit eigenem Eintrag auf", async () => {
    setup({ workspace: role("member", 2, allow("project.view")) });
    mockProjectFindMany.mockResolvedValue([
      { id: "p2", visibility: "private" },
    ]);
    mockProjectMemberFindMany.mockResolvedValue([
      { projectId: "p2", role: role("contributor", 3, allow("project.view")) },
    ]);

    const visible = await accessibleProjectIds("u1", "ws1");
    expect([...visible]).toEqual(["p2"]);
  });

  it("respektiert ein DENY der Projektrolle", async () => {
    setup({ workspace: role("member", 2, allow("project.view")) });
    mockProjectFindMany.mockResolvedValue([{ id: "p1", visibility: "public" }]);
    mockProjectMemberFindMany.mockResolvedValue([
      {
        projectId: "p1",
        role: role("blocked", 0, [["project.view", "DENY"]]),
      },
    ]);

    const visible = await accessibleProjectIds("u1", "ws1");
    expect([...visible]).toEqual([]);
  });

  it("zeigt einem Owner auch die privaten", async () => {
    setup({
      workspace: role("owner", 6, allow("project.view", "project.view.all")),
    });
    mockProjectFindMany.mockResolvedValue([
      { id: "p1", visibility: "public" },
      { id: "p2", visibility: "private" },
    ]);
    mockProjectMemberFindMany.mockResolvedValue([]);

    const visible = await accessibleProjectIds("u1", "ws1");
    expect([...visible].sort()).toEqual(["p1", "p2"]);
  });

  it("gibt ohne Session eine leere Menge", async () => {
    expect([...(await accessibleProjectIds(null, "ws1"))]).toEqual([]);
  });
});
