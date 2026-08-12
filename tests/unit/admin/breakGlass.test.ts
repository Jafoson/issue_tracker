import { beforeEach, describe, expect, it, mock } from "bun:test";

// Der Notfall-Zugriff ist die einzige Stelle, an der die Plattformverwaltung an
// Inhalte kommt. Diese Datei prüft die drei Zusagen, die ihn tragbar machen:
// eine Begründung ist Pflicht, Mitgliedschaft und Protokolleintrag entstehen
// zusammen, und ohne das Recht passiert gar nichts.

const mockProjectFindUnique = mock();
const mockProjectMemberFindUnique = mock();
const mockProjectMemberCreate = mock();
const mockAuditCreate = mock();
const mockUserFindUnique = mock(async () => ({
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
}));

/**
 * Die Transaktion führt ihren Rückruf mit demselben Klienten aus.
 *
 * Genau darum geht es hier: `recordAuditIn` bekommt `tx`, nicht `db`. Wirft der
 * Rückruf, wäre in Wahrheit beides zurückgerollt — der Test prüft deshalb, dass
 * beide Schreibvorgänge *innerhalb* dieses Rückrufs stattfinden.
 */
const client = {
  project: { findUnique: mockProjectFindUnique },
  projectMember: {
    findUnique: mockProjectMemberFindUnique,
    create: mockProjectMemberCreate,
  },
  auditLog: { create: mockAuditCreate },
  user: { findUnique: mockUserFindUnique },
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
};

mock.module("@/lib/db", () => ({ db: client }));
mock.module("next/cache", () => ({ revalidatePath: mock() }));

const mockGetAccess = mock();
const mockCurrentUserId = mock(async () => "admin1");
mock.module("@/lib/permissions", () => ({
  getAccess: mockGetAccess,
  currentUserId: mockCurrentUserId,
  assignmentCeiling: () => Number.POSITIVE_INFINITY,
  PLATFORM: { scope: "platform" },
}));

import { breakGlassJoinProject } from "@/features/admin/actions";

const REASON = "Projektleitung im Krankenhaus, Freigabe muss heute raus";

function allow(...keys: string[]) {
  mockGetAccess.mockResolvedValue({ has: (key: string) => keys.includes(key) });
}

beforeEach(() => {
  mock.clearAllMocks();
  mockCurrentUserId.mockResolvedValue("admin1");
  mockUserFindUnique.mockResolvedValue({
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
  });
  mockProjectFindUnique.mockResolvedValue({
    name: "Kündigungen Q3",
    workspaceId: "ws1",
  });
  mockProjectMemberFindUnique.mockResolvedValue(null);
  mockProjectMemberCreate.mockResolvedValue({});
  mockAuditCreate.mockResolvedValue({});
});

describe("Notfall-Zugriff", () => {
  it("verlangt das Recht", async () => {
    allow("platform.access", "user.manage");

    const result = await breakGlassJoinProject({
      projectId: "p1",
      reason: REASON,
    });

    expect(result).toEqual({ error: "You are not allowed to do this." });
    expect(mockProjectMemberCreate).not.toHaveBeenCalled();
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it("verlangt eine Begründung", async () => {
    allow("project.breakglass");

    const result = await breakGlassJoinProject({ projectId: "p1", reason: "" });

    expect("error" in result).toBe(true);
    expect(mockProjectMemberCreate).not.toHaveBeenCalled();
  });

  it("lässt eine zu kurze Begründung nicht durchgehen", async () => {
    allow("project.breakglass");

    const result = await breakGlassJoinProject({
      projectId: "p1",
      reason: "  weil  ",
    });

    expect("error" in result).toBe(true);
    expect(mockProjectMemberCreate).not.toHaveBeenCalled();
  });

  it("trägt ein und protokolliert — beides oder nichts", async () => {
    allow("project.breakglass");

    const result = await breakGlassJoinProject({
      projectId: "p1",
      reason: REASON,
    });

    expect(result).toEqual({ ok: true });

    expect(mockProjectMemberCreate).toHaveBeenCalledTimes(1);
    expect(mockProjectMemberCreate.mock.calls[0][0].data).toMatchObject({
      projectId: "p1",
      userId: "admin1",
      // Sichtbar in der Mitgliederliste wie jede andere Mitgliedschaft.
      roleId: "sys:PROJECT:project_admin",
    });

    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    const entry = mockAuditCreate.mock.calls[0][0].data;
    expect(entry).toMatchObject({
      action: "project.breakglass",
      actorId: "admin1",
      projectId: "p1",
      workspaceId: "ws1",
      reason: REASON,
    });
    // Der Name wird beim Schreiben eingefroren, nicht beim Lesen aufgelöst.
    expect(entry.actorLabel).toBe("Ada Lovelace (ada@example.com)");
    expect(entry.targetLabel).toBe("Kündigungen Q3");
  });

  it("weist ab, wer ohnehin schon Mitglied ist", async () => {
    allow("project.breakglass");
    mockProjectMemberFindUnique.mockResolvedValue({ userId: "admin1" });

    const result = await breakGlassJoinProject({
      projectId: "p1",
      reason: REASON,
    });

    expect("error" in result).toBe(true);
    // Kein Protokolleintrag: es war kein Notfall-Zugriff, sondern der Normalweg.
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it("weist ab, wenn es das Projekt nicht mehr gibt", async () => {
    allow("project.breakglass");
    mockProjectFindUnique.mockResolvedValue(null);

    const result = await breakGlassJoinProject({
      projectId: "p1",
      reason: REASON,
    });

    expect("error" in result).toBe(true);
    expect(mockProjectMemberCreate).not.toHaveBeenCalled();
  });
});
