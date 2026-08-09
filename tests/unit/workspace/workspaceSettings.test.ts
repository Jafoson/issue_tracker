import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockWorkspaceUpdate = mock();
const mockWorkspaceDelete = mock();
const mockTransaction = mock();

const mockTx = {
  issue: { deleteMany: mock() },
  workspace: { delete: mockWorkspaceDelete },
};

mock.module("@/lib/db", () => ({
  db: {
    workspace: { update: mockWorkspaceUpdate, delete: mockWorkspaceDelete },
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
  deleteWorkspace,
  updateWorkspace,
} from "@/features/workspaces/actions";

const WS = "acme";
const ACTOR = "u-actor";

function reset() {
  for (const m of [
    mockWorkspaceUpdate,
    mockWorkspaceDelete,
    mockTransaction,
    mockCan,
    mockCurrentUserId,
    mockTx.issue.deleteMany,
  ]) {
    m.mockReset();
  }
  mockCurrentUserId.mockResolvedValue(ACTOR);
  mockCan.mockResolvedValue(true);
  mockWorkspaceUpdate.mockResolvedValue({ id: WS });
  mockWorkspaceDelete.mockResolvedValue({ id: WS });
  mockTx.issue.deleteMany.mockResolvedValue({ count: 0 });
  mockTransaction.mockImplementation(
    async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
  );
}

describe("updateWorkspace()", () => {
  beforeEach(reset);

  it("lehnt ab, wenn niemand eingeloggt ist", async () => {
    mockCurrentUserId.mockResolvedValue(null);
    expect(await updateWorkspace(WS, { name: "Neu" })).toEqual({
      error: "You must be logged in.",
    });
    expect(mockWorkspaceUpdate).not.toHaveBeenCalled();
  });

  it("verlangt workspace.update im Workspace-Kontext", async () => {
    mockCan.mockResolvedValue(false);
    expect(await updateWorkspace(WS, { name: "Neu" })).toEqual({
      error: "You are not allowed to change this workspace.",
    });
    expect(mockCan).toHaveBeenCalledWith(ACTOR, "workspace.update", {
      workspaceId: WS,
    });
    expect(mockWorkspaceUpdate).not.toHaveBeenCalled();
  });

  it("lehnt einen leeren Namen ab", async () => {
    expect(await updateWorkspace(WS, { name: "   " })).toEqual({
      error: "Name is required.",
    });
    expect(mockWorkspaceUpdate).not.toHaveBeenCalled();
  });

  it("schreibt nur, was übergeben wurde", async () => {
    expect(await updateWorkspace(WS, { color: "#123456" })).toEqual({
      ok: true,
    });
    expect(mockWorkspaceUpdate.mock.calls[0][0]).toEqual({
      where: { id: WS },
      data: { color: "#123456" },
    });
  });

  it("trimmt den Namen", async () => {
    await updateWorkspace(WS, { name: "  Acme  " });
    expect(mockWorkspaceUpdate.mock.calls[0][0].data).toEqual({ name: "Acme" });
  });

  // Der Slug ist zugleich die Id und steht in jeder Adresse — die Action nimmt
  // ihn gar nicht erst entgegen. Der Test hält das fest.
  it("rührt den Slug nicht an", async () => {
    await updateWorkspace(WS, { name: "Acme", color: "#fff" });
    const data = mockWorkspaceUpdate.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("slug");
    expect(data).not.toHaveProperty("id");
  });
});

describe("deleteWorkspace()", () => {
  beforeEach(reset);

  it("verlangt workspace.delete", async () => {
    mockCan.mockResolvedValue(false);
    expect(await deleteWorkspace(WS)).toEqual({
      error: "You are not allowed to delete this workspace.",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  // Der Fremdschlüssel der Issues auf das Projekt steht auf `Restrict` — ohne
  // diesen ersten Schritt scheitert das Löschen der Projekte.
  it("löscht erst die Aufgaben, dann den Workspace", async () => {
    expect(await deleteWorkspace(WS)).toEqual({ ok: true });
    expect(mockTx.issue.deleteMany).toHaveBeenCalledWith({
      where: { project: { workspaceId: WS } },
    });
    expect(mockWorkspaceDelete).toHaveBeenCalledWith({ where: { id: WS } });
    expect(mockTx.issue.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      mockWorkspaceDelete.mock.invocationCallOrder[0],
    );
  });
});
