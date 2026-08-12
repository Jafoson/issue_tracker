import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUserFindUnique = mock();
const mockWorkspaceFindUnique = mock();
const mockWorkspaceMemberFindUnique = mock();
const mockProjectFindUnique = mock();
const mockProjectMemberFindUnique = mock();
const mockProjectFindMany = mock();
const mockProjectMemberFindMany = mock();
const mockProjectMemberFindFirst = mock();

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
      findFirst: mockProjectMemberFindFirst,
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
  canEnterWorkspace,
} from "@/lib/permissions";

// ── Helfer ────────────────────────────────────────────────────────────────────

function role(key: string, rank: number, permissions: string[]) {
  return {
    key,
    rank,
    permissions: permissions.map((permissionKey) => ({ permissionKey })),
  };
}

/** Liest sich an der Aufrufstelle besser als ein nacktes Array. */
const allow = (...keys: string[]): string[] => keys;

/** Standardaufbau: kein globales Recht, ein offener Workspace, ein öffentliches Projekt. */
function setup(
  opts: {
    platform?: ReturnType<typeof role> | null;
    workspace?: ReturnType<typeof role> | null;
    project?: ReturnType<typeof role> | null;
    pending?: boolean;
    suspended?: boolean;
    visibility?: string;
    deactivated?: boolean;
  } = {},
) {
  mockUserFindUnique.mockResolvedValue({
    platformRole: opts.platform ?? null,
    deactivatedAt: opts.deactivated ? new Date("2026-01-01") : null,
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
  // `canEnterWorkspace` fragt danach: steht die Person in irgendeinem Projekt
  // des Workspace? Standardlage ist „nur, wenn sie eine Projektrolle hat".
  mockProjectMemberFindFirst.mockResolvedValue(
    opts.project ? { projectId: "p1" } : null,
  );
}

beforeEach(() => {
  mock.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Im Projekt entscheidet die Projektrolle", () => {
  it("ersetzt die projektbezogenen Rechte der Workspace-Rolle", async () => {
    setup({
      workspace: role("member", 2, allow("project.view", "issue.create")),
      project: role("project_viewer", 2, allow("project.view")),
    });

    const access = await accessFor("u1", { projectId: "p1" });
    // Aus der Projektrolle.
    expect(access.has("project.view")).toBe(true);
    // Die Workspace-Rolle gibt es, im Projekt zählt sie dafür aber nicht.
    expect(access.has("issue.create")).toBe(false);
  });

  it("gibt im Projekt nichts heraus, was nur im Workspace gilt", async () => {
    setup({
      workspace: role("manager", 4, allow("audit.view", "project.create")),
      project: role("project_viewer", 2, allow("project.view")),
    });

    const access = await accessFor("u1", { projectId: "p1" });
    // Der Projekt-Kontext beantwortet nur Projektfragen. Wer wissen will, ob
    // jemand ein Projekt anlegen darf, fragt den Workspace-Kontext.
    expect(access.has("audit.view")).toBe(false);
    expect(access.has("project.create")).toBe(false);
    expect(access.has("project.view")).toBe(true);
  });

  it("übergeht einen Eintrag, den die Projektrolle gar nicht tragen darf", async () => {
    // Der Scope-Filter in `collect()`: eine Zeile aus einer früheren Fassung
    // oder von Hand gesetzt wird wirkungslos, statt Rechte zu verschenken.
    setup({
      project: role(
        "project_admin",
        4,
        allow("project.view", "workspace.delete", "team.create"),
      ),
    });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(true);
    expect(access.has("workspace.delete")).toBe(false);
    expect(access.has("team.create")).toBe(false);
  });

  it("gibt ohne Projektrolle keine Projektrechte", async () => {
    // `ProjectMember` ist die Liste, wer im Projekt ist — kein Eintrag, kein
    // Zugriff, auch bei einem öffentlichen Projekt.
    setup({
      workspace: role("member", 2, allow("project.view", "issue.create")),
    });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(false);
    expect(access.has("issue.create")).toBe(false);
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

// Es gibt kein Verbot mehr — eine Rolle listet, was sie erlaubt, und der Rest
// gilt nicht. Weil im Kontext ohnehin nur eine Rolle zählt, wäre ein DENY von
// „steht nicht in der Liste" nicht zu unterscheiden gewesen.
describe("Die Liste der Rolle ist abschließend", () => {
  it("stuft in diesem einen Projekt herab", async () => {
    // Genau der Fall aus der Praxis: jemand mit Gewicht im Workspace ist in
    // diesem Projekt nur Leser. Es braucht dafür kein Verbot — was in der
    // Projektrolle nicht steht, gilt hier eben nicht.
    setup({
      workspace: role("project_lead", 3, allow("project.create")),
      project: role("project_viewer", 2, allow("project.view")),
    });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(true);
    expect(access.has("issue.update.any")).toBe(false);
  });

  it("nimmt eine Permission nicht an, nur weil sie irgendwo steht", async () => {
    // Der Gegenprobe wegen: dieselbe Person, dasselbe Projekt, aber diesmal
    // führt die Projektrolle das Recht — dann gilt es auch.
    setup({
      workspace: role("project_lead", 3, allow("project.create")),
      project: role(
        "contributor",
        3,
        allow("project.view", "issue.update.any"),
      ),
    });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("issue.update.any")).toBe(true);
  });
});

// Die Zusage, um die es beim Zuschnitt der Ebenen am Ende geht: die Leitung
// eines Workspace bleibt in jedem seiner Projekte handlungsfähig, egal was in
// `ProjectMember` steht.
describe("Generalschlüssel project.admin.all", () => {
  it("gibt alle Projektrechte ohne jeden Projekteintrag", async () => {
    setup({ workspace: role("admin", 5, allow("project.admin.all")) });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(true);
    expect(access.has("issue.delete.any")).toBe(true);
    expect(access.has("member.invite")).toBe(true);
    expect(access.has("role.manage")).toBe(true);
  });

  it("lässt sich von `blocked` nicht aussperren", async () => {
    // Sonst könnte ein Project Admin den Owner aus dessen eigenem Projekt
    // werfen — und niemand käme mehr an die Mitgliederverwaltung.
    setup({
      workspace: role("owner", 6, allow("project.admin.all")),
      project: role("blocked", 0, []),
    });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(true);
    expect(access.has("member.invite")).toBe(true);
    // Und die Rangfolge bleibt nach oben offen, sonst ließe sich die
    // Herabstufung nicht zurücknehmen.
    expect(assignmentCeiling(access, "PROJECT")).toBe(Number.POSITIVE_INFINITY);
  });

  it("hilft in einem gesperrten Workspace nicht", async () => {
    // Eine Sperre des Betreibers steht über dem Generalschlüssel des Mandanten.
    setup({
      workspace: role("owner", 6, allow("project.admin.all")),
      suspended: true,
    });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(false);
  });

  it("bleibt eine Workspace-Sache — als Projektrolle wirkungslos", async () => {
    setup({ project: role("seltsam", 4, allow("project.admin.all")) });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.admin.all")).toBe(false);
    expect(access.has("issue.create")).toBe(false);
  });
});

describe("Generalschlüssel project.view.all", () => {
  it("öffnet jedes Projekt lesend, aber nicht mehr", async () => {
    setup({ workspace: role("auditor", 3, allow("project.view.all")) });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(true);
    expect(access.has("issue.create")).toBe(false);
    expect(access.has("member.invite")).toBe(false);
  });

  it("ergänzt eine vorhandene Projektrolle, statt sie zu ersetzen", async () => {
    setup({
      workspace: role("auditor", 3, allow("project.view.all")),
      project: role("contributor", 3, allow("issue.create")),
    });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(true);
    expect(access.has("issue.create")).toBe(true);
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

  it("hält Plattform-Rechte aus dem Mandanten-Kontext heraus", async () => {
    // Auch nach unten gilt die Trennung: im Workspace zählt die Workspace-Rolle.
    // Plattform-Rechte fragt man im Plattform-Kontext ab — dort stehen sie.
    setup({ platform: role("platform_admin", 2, allow("platform.access")) });

    expect(
      (await accessFor("u1", { workspaceId: "ws1" })).has("platform.access"),
    ).toBe(false);
    expect(
      (await accessFor("u1", { scope: "platform" })).has("platform.access"),
    ).toBe(true);
  });

  it("stört die Rechte des Benutzers nicht", async () => {
    setup({
      platform: role("platform_member", 0, []),
      workspace: role("member", 2, []),
      project: role("contributor", 3, allow("project.view")),
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

  it("lässt Plattform-Rechte von einer Sperre unberührt", async () => {
    // Die Sperre trifft den Mandanten, nicht die Plattform-Rolle. Sie steht in
    // ihrem eigenen Kontext und ist dort weiter da — sonst könnte niemand den
    // Workspace wieder entsperren.
    setup({
      platform: role("platform_admin", 2, allow("workspace.suspend")),
      workspace: role("owner", 6, allow("workspace.update")),
      suspended: true,
    });

    expect(
      (await accessFor("u1", { scope: "platform" })).has("workspace.suspend"),
    ).toBe(true);
    expect(
      (await accessFor("u1", { workspaceId: "ws1" })).has("workspace.update"),
    ).toBe(false);
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

describe("Mitgliedschaft entscheidet", () => {
  it("sperrt ein Projekt ohne Eintrag, egal wie sichtbar es ist", async () => {
    setup({ workspace: role("member", 2, allow("audit.view")) });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(false);
    // Im Workspace-Kontext ist das Recht unverändert da — nur beantwortet es
    // eine andere Frage als die nach diesem Projekt.
    expect(
      (await accessFor("u1", { workspaceId: "ws1" })).has("audit.view"),
    ).toBe(true);
  });

  it("öffnet es mit einem eigenen Projekteintrag", async () => {
    setup({
      workspace: role("member", 2, []),
      project: role("contributor", 3, allow("project.view")),
    });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(true);
  });

  it("öffnet es für project.view.all auch ohne Eintrag", async () => {
    setup({ workspace: role("admin", 5, allow("project.view.all")) });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(true);
  });

  it("lässt die Leitung des Workspace nicht herabstufen", async () => {
    // Ein Project Admin könnte sonst den Owner aus dessen eigenem Projekt
    // aussperren — und niemand käme mehr an die Mitgliederverwaltung.
    setup({
      workspace: role(
        "owner",
        6,
        allow("project.view.all", "project.admin.all"),
      ),
      project: role("project_viewer", 2, allow("project.view")),
    });

    const access = await accessFor("u1", { projectId: "p1" });
    // Die Projektrolle führt `member.invite` nicht — der Generalschlüssel
    // entscheidet trotzdem, weil er vor ihr geprüft wird.
    expect(access.has("member.invite")).toBe(true);
    // Und die Rangfolge bleibt nach oben offen, sonst ließe sich die
    // Herabstufung nicht zurücknehmen.
    expect(assignmentCeiling(access, "PROJECT")).toBe(Number.POSITIVE_INFINITY);
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

// Zutritt ist keine Permission — er entscheidet, ob die Workspace-Hülle
// überhaupt rendert. Drei Wege hinein, und eine offene Einladung ist keiner.
describe("canEnterWorkspace", () => {
  it("lässt Mitglieder hinein", async () => {
    setup({ workspace: role("member", 2, allow("project.view")) });
    expect(await canEnterWorkspace("u1", "ws1")).toBe(true);
  });

  it("sperrt aus, wer weder im Workspace noch in einem Projekt ist", async () => {
    setup();
    expect(await canEnterWorkspace("u1", "ws1")).toBe(false);
  });

  it("lässt einen Projekt-Gast ohne Workspace-Mitgliedschaft hinein", async () => {
    setup();
    // Kein `WorkspaceMember`, aber eine Zeile in einem Projekt des Workspace.
    mockProjectMemberFindFirst.mockResolvedValue({ projectId: "p1" });
    expect(await canEnterWorkspace("u1", "ws1")).toBe(true);
  });

  it("sperrt einen gesperrten Workspace zu", async () => {
    setup({
      workspace: role("owner", 6, allow("project.view.all")),
      suspended: true,
    });
    expect(await canEnterWorkspace("u1", "ws1")).toBe(false);
  });

  it("lässt eine offene Einladung nicht hinein", async () => {
    setup({
      workspace: role("member", 2, allow("project.view")),
      pending: true,
    });
    expect(await canEnterWorkspace("u1", "ws1")).toBe(false);
  });

  it("lässt Support überall hinein", async () => {
    setup({
      platform: role("platform_support", 1, allow("tenant.access")),
      suspended: true,
    });
    expect(await canEnterWorkspace("u1", "ws1")).toBe(true);
  });

  it("lässt einen Plattform-Admin ohne tenant.access nicht hinein", async () => {
    setup({
      platform: role(
        "platform_admin",
        2,
        allow("platform.access", "user.manage"),
      ),
    });
    expect(await canEnterWorkspace("u1", "ws1")).toBe(false);
  });

  it("verlangt eine Session", async () => {
    setup({ workspace: role("owner", 6, allow("project.view.all")) });
    expect(await canEnterWorkspace(null, "ws1")).toBe(false);
  });
});

describe("accessibleProjectIds", () => {
  it("zeigt nur, wo eine Projektrolle vorliegt", async () => {
    setup({ workspace: role("member", 2, allow("project.view")) });
    mockProjectFindMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    mockProjectMemberFindMany.mockResolvedValue([
      { projectId: "p1", role: role("contributor", 3, allow("project.view")) },
    ]);

    const visible = await accessibleProjectIds("u1", "ws1");
    expect([...visible]).toEqual(["p1"]);
  });

  it("zeigt nichts ohne jede Projektrolle", async () => {
    setup({ workspace: role("member", 2, allow("project.view")) });
    mockProjectFindMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    mockProjectMemberFindMany.mockResolvedValue([]);

    const visible = await accessibleProjectIds("u1", "ws1");
    expect([...visible]).toEqual([]);
  });

  it("verbirgt ein Projekt, dessen Rolle project.view nicht führt", async () => {
    setup({ workspace: role("member", 2, allow("project.view")) });
    mockProjectFindMany.mockResolvedValue([{ id: "p1" }]);
    mockProjectMemberFindMany.mockResolvedValue([
      { projectId: "p1", role: role("blocked", 0, []) },
    ]);

    const visible = await accessibleProjectIds("u1", "ws1");
    expect([...visible]).toEqual([]);
  });

  it("zeigt einem Owner alles, auch ohne Eintrag", async () => {
    setup({
      workspace: role("owner", 6, allow("project.view", "project.view.all")),
    });
    mockProjectFindMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    mockProjectMemberFindMany.mockResolvedValue([]);

    const visible = await accessibleProjectIds("u1", "ws1");
    expect([...visible].sort()).toEqual(["p1", "p2"]);
  });

  it("zeigt in einem gesperrten Workspace nichts", async () => {
    setup({
      workspace: role("owner", 6, allow("project.view")),
      suspended: true,
    });
    mockProjectFindMany.mockResolvedValue([{ id: "p1" }]);
    mockProjectMemberFindMany.mockResolvedValue([
      {
        projectId: "p1",
        role: role("project_admin", 4, allow("project.view")),
      },
    ]);

    expect([...(await accessibleProjectIds("u1", "ws1"))]).toEqual([]);
  });

  it("gibt ohne Session eine leere Menge", async () => {
    expect([...(await accessibleProjectIds(null, "ws1"))]).toEqual([]);
  });
});

// ── Stillgelegte Konten ───────────────────────────────────────────────────────
//
// Die Sperre steht vor jeder Rollenauflösung. Die Fälle hier prüfen genau das:
// nicht, dass ein stillgelegtes Konto weniger bekommt, sondern dass es *nichts*
// bekommt — auch dann, wenn seine Rollen für sich genommen alles erlaubten.

describe("Ein stillgelegtes Konto bekommt nirgends Rechte", () => {
  it("nicht auf der Plattform, auch mit voller Plattform-Rolle", async () => {
    setup({
      deactivated: true,
      platform: role(
        "platform_admin",
        2,
        allow("platform.access", "user.manage"),
      ),
    });

    const access = await accessFor("u1", { scope: "platform" });
    expect(access.has("platform.access")).toBe(false);
    expect(access.has("user.manage")).toBe(false);
  });

  it("nicht im Workspace, auch als Owner", async () => {
    setup({
      deactivated: true,
      workspace: role(
        "owner",
        6,
        allow("workspace.update", "project.admin.all"),
      ),
    });

    const access = await accessFor("u1", { workspaceId: "ws1" });
    expect(access.has("workspace.update")).toBe(false);
  });

  it("nicht im Projekt, auch mit Projektrolle", async () => {
    setup({
      deactivated: true,
      workspace: role("member", 2, []),
      project: role("project_admin", 4, allow("project.view", "issue.create")),
    });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(false);
    expect(access.has("issue.create")).toBe(false);
  });

  it("hebt auch den Support-Generalschlüssel auf", async () => {
    // `tenant.access` steht sonst vor allen Regeln. Die Stilllegung steht davor.
    setup({
      deactivated: true,
      platform: role("platform_support", 1, allow("tenant.access")),
    });

    const access = await accessFor("u1", { projectId: "p1" });
    expect(access.has("project.view")).toBe(false);
  });

  it("lässt es nicht mehr in den Workspace", async () => {
    setup({
      deactivated: true,
      workspace: role("owner", 6, allow("workspace.update")),
    });

    expect(await canEnterWorkspace("u1", "ws1")).toBe(false);
  });

  it("zeigt ihm kein einziges Projekt", async () => {
    setup({
      deactivated: true,
      workspace: role("owner", 6, allow("project.view.all")),
    });
    mockProjectFindMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    mockProjectMemberFindMany.mockResolvedValue([]);

    expect([...(await accessibleProjectIds("u1", "ws1"))]).toEqual([]);
  });
});
