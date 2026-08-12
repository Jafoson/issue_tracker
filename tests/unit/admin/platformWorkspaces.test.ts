import { beforeEach, describe, expect, it, mock } from "bun:test";

// Sperren und Löschen eines Mandanten.
//
// Die eine Regel, die diese Datei vor allem festhält: **gelöscht wird nur, was
// schon gesperrt ist.** Sie steht im Server und nicht nur im Dialog — eine
// Bestätigung im Browser ist eine Bitte, keine Bedingung.

const mockWorkspaceFindUnique = mock();
const mockWorkspaceUpdate = mock();
const mockWorkspaceDelete = mock();
const mockIssueDeleteMany = mock();
const mockIssueCount = mock();
const mockAuditCreate = mock();
const mockUserFindUnique = mock();

const client = {
  workspace: {
    findUnique: mockWorkspaceFindUnique,
    update: mockWorkspaceUpdate,
    delete: mockWorkspaceDelete,
  },
  issue: { deleteMany: mockIssueDeleteMany, count: mockIssueCount },
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

import {
  deleteWorkspaceAsPlatform,
  setWorkspaceSuspended,
} from "@/features/admin/actions";

function allow(...keys: string[]) {
  mockGetAccess.mockResolvedValue({ has: (key: string) => keys.includes(key) });
}

/** Der Mandant, auf den sich die Fälle beziehen. */
function workspace(opts: { suspended?: boolean } = {}) {
  mockWorkspaceFindUnique.mockResolvedValue({
    name: "Nimbus",
    suspended: opts.suspended ?? false,
    _count: { members: 7, projects: 3 },
  });
}

beforeEach(() => {
  mock.clearAllMocks();
  mockCurrentUserId.mockResolvedValue("admin1");
  mockUserFindUnique.mockResolvedValue({
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
  });
  mockWorkspaceUpdate.mockResolvedValue({});
  mockWorkspaceDelete.mockResolvedValue({});
  mockIssueDeleteMany.mockResolvedValue({ count: 0 });
  mockIssueCount.mockResolvedValue(24);
  mockAuditCreate.mockResolvedValue({});
  workspace();
});

describe("Sperren", () => {
  it("verlangt workspace.suspend", async () => {
    allow("platform.access", "user.manage");

    const result = await setWorkspaceSuspended("nimbus", true);

    expect(result).toEqual({ error: "You are not allowed to do this." });
    expect(mockWorkspaceUpdate).not.toHaveBeenCalled();
  });

  it("setzt das Flag und protokolliert, wen es trifft", async () => {
    allow("workspace.suspend");

    const result = await setWorkspaceSuspended(
      "nimbus",
      true,
      "Rechnung offen",
    );

    expect(result).toEqual({ ok: true });
    expect(mockWorkspaceUpdate.mock.calls[0][0].data).toEqual({
      suspended: true,
    });

    const entry = mockAuditCreate.mock.calls[0][0].data;
    expect(entry).toMatchObject({
      action: "workspace.suspended",
      targetLabel: "Nimbus",
      reason: "Rechnung offen",
    });
    expect(entry.meta).toEqual({ members: 7 });
  });

  it("gibt mit demselben Weg wieder frei", async () => {
    allow("workspace.suspend");
    workspace({ suspended: true });

    await setWorkspaceSuspended("nimbus", false);

    expect(mockWorkspaceUpdate.mock.calls[0][0].data).toEqual({
      suspended: false,
    });
    expect(mockAuditCreate.mock.calls[0][0].data).toMatchObject({
      action: "workspace.unsuspended",
    });
  });
});

describe("Löschen", () => {
  it("verlangt workspace.delete", async () => {
    allow("workspace.suspend");
    workspace({ suspended: true });

    const result = await deleteWorkspaceAsPlatform("nimbus", "Nimbus");

    expect(result).toEqual({ error: "You are not allowed to do this." });
    expect(mockWorkspaceDelete).not.toHaveBeenCalled();
  });

  it("weigert sich, solange der Mandant läuft", async () => {
    // Die eigentliche Sicherung: erst sperren, dann löschen. Zwischen beiden
    // Schritten liegt eine bewusste zweite Handlung.
    allow("workspace.delete");
    workspace({ suspended: false });

    const result = await deleteWorkspaceAsPlatform("nimbus", "Nimbus");

    expect(result).toEqual({
      error: "Suspend this workspace before deleting it.",
    });
    expect(mockWorkspaceDelete).not.toHaveBeenCalled();
    expect(mockIssueDeleteMany).not.toHaveBeenCalled();
  });

  it("weigert sich bei einem falsch getippten Namen", async () => {
    allow("workspace.delete");
    workspace({ suspended: true });

    const result = await deleteWorkspaceAsPlatform("nimbus", "nimbus");

    expect(result).toEqual({ error: "The name does not match." });
    expect(mockWorkspaceDelete).not.toHaveBeenCalled();
  });

  it("löscht die Aufgaben vor dem Workspace", async () => {
    // `Issue.projectId` steht auf `Restrict` — andersherum ließe sich das
    // Projekt gar nicht löschen.
    allow("workspace.delete");
    workspace({ suspended: true });

    const result = await deleteWorkspaceAsPlatform("nimbus", "  Nimbus  ");

    expect(result).toEqual({ ok: true });
    expect(mockIssueDeleteMany).toHaveBeenCalled();
    expect(mockWorkspaceDelete).toHaveBeenCalled();
    expect(mockIssueDeleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      mockWorkspaceDelete.mock.invocationCallOrder[0],
    );
  });

  it("hält im Protokoll fest, was verloren ging", async () => {
    allow("workspace.delete");
    workspace({ suspended: true });

    await deleteWorkspaceAsPlatform("nimbus", "Nimbus");

    const entry = mockAuditCreate.mock.calls[0][0].data;
    expect(entry).toMatchObject({
      action: "workspace.deleted",
      targetLabel: "Nimbus",
    });
    // Die Zahlen werden vor dem Löschen gelesen — danach gäbe es nichts mehr zu
    // zählen, und der Eintrag wäre eine leere Behauptung.
    expect(entry.meta).toEqual({
      members: 7,
      projects: 3,
      issues: 24,
      from: "platform",
    });
  });
});
