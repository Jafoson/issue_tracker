import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockTx = {
  workspace: { create: mock() },
  workspaceStatus: { createMany: mock() },
  workspacePriority: { createMany: mock() },
  workspaceIssueType: { createMany: mock() },
  workspaceMember: { create: mock() },
  project: { create: mock() },
};

const mockProvisionRbac = mock();

mock.module("@/lib/db", () => ({
  db: {
    workspace: { findUnique: mock() },
    $transaction: mock(),
  },
}));

mock.module("@/lib/session", () => ({
  createSession: mock(),
  clearSession: mock(),
  getSession: mock(),
}));

mock.module("@/lib/workspace-defaults", () => ({
  DEFAULT_STATUSES: [{ id: "status-1" }, { id: "status-2" }],
  DEFAULT_PRIORITIES: [{ id: "prio-1" }],
  DEFAULT_ISSUE_TYPES: [{ id: "type-1" }],
}));

mock.module("@/lib/rbac-provision", () => ({
  provisionWorkspaceRbac: mockProvisionRbac,
}));

import { createWorkspace } from "@/features/workspaces/actions";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

const mockWorkspaceFindUnique = db.workspace.findUnique as ReturnType<
  typeof mock
>;
const mockTransaction = db.$transaction as ReturnType<typeof mock>;
const mockGetSession = getSession as ReturnType<typeof mock>;

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.append(k, v);
  return fd;
}

function resetTxMocks() {
  for (const group of Object.values(mockTx)) {
    for (const fn of Object.values(group)) {
      const m = fn as ReturnType<typeof mock>;
      m.mockReset();
      m.mockResolvedValue({});
    }
  }
}

describe("createWorkspace()", () => {
  beforeEach(() => {
    mockWorkspaceFindUnique.mockReset();
    mockTransaction.mockReset();
    mockGetSession.mockReset();
    resetTxMocks();
    mockProvisionRbac.mockReset();
    mockProvisionRbac.mockResolvedValue(undefined);
    mockWorkspaceFindUnique.mockResolvedValue(null);
    mockTransaction.mockImplementation(
      async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
        await fn(mockTx);
      },
    );
  });

  describe("Auth-Prüfung", () => {
    it("gibt Fehler zurück wenn User nicht eingeloggt ist", async () => {
      mockGetSession.mockResolvedValue(null);
      const result = await createWorkspace(
        makeFormData({ name: "My WS", slug: "my-ws" }),
      );
      expect(result).toEqual({ error: "You must be logged in." });
    });

    it("führt keine DB-Operationen durch wenn nicht eingeloggt", async () => {
      mockGetSession.mockResolvedValue(null);
      await createWorkspace(makeFormData({ name: "My WS", slug: "my-ws" }));
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe("Validierung", () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({ userId: "user-1" });
    });

    it("gibt Fehler zurück wenn Name fehlt", async () => {
      const result = await createWorkspace(makeFormData({ slug: "my-ws" }));
      expect(result).toEqual({ error: "Name and slug are required." });
    });

    it("gibt Fehler zurück wenn Slug fehlt", async () => {
      const result = await createWorkspace(
        makeFormData({ name: "My Workspace" }),
      );
      expect(result).toEqual({ error: "Name and slug are required." });
    });

    it("gibt Fehler zurück wenn Slug Großbuchstaben enthält", async () => {
      const result = await createWorkspace(
        makeFormData({ name: "My Workspace", slug: "My-Workspace" }),
      );
      expect(result).toEqual({
        error: "Slug may only contain lowercase letters, numbers, and hyphens.",
      });
    });

    it("gibt Fehler zurück wenn Slug Sonderzeichen enthält", async () => {
      const result = await createWorkspace(
        makeFormData({ name: "My Workspace", slug: "my_workspace!" }),
      );
      expect(result).toEqual({
        error: "Slug may only contain lowercase letters, numbers, and hyphens.",
      });
    });

    it("hängt eine Nummer an wenn der Slug bereits vergeben ist", async () => {
      mockWorkspaceFindUnique.mockImplementation(
        async ({ where }: { where: { slug: string } }) =>
          where.slug === "existing" ? { id: "existing" } : null,
      );
      const result = await createWorkspace(
        makeFormData({ name: "My Workspace", slug: "existing", locale: "de" }),
      );
      expect((result as { redirectTo: string }).redirectTo).toBe(
        "/de/existing1",
      );
    });

    it("zählt weiter hoch wenn auch der erste Fallback-Slug vergeben ist", async () => {
      const taken = new Set(["existing", "existing1"]);
      mockWorkspaceFindUnique.mockImplementation(
        async ({ where }: { where: { slug: string } }) =>
          taken.has(where.slug) ? { id: where.slug } : null,
      );
      const result = await createWorkspace(
        makeFormData({ name: "My Workspace", slug: "existing", locale: "de" }),
      );
      expect((result as { redirectTo: string }).redirectTo).toBe(
        "/de/existing2",
      );
    });
  });

  describe("Erfolgreiche Workspace-Erstellung", () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({ userId: "user-1" });
    });

    it("gibt redirectTo zurück nach erfolgreicher Erstellung", async () => {
      const result = await createWorkspace(
        makeFormData({
          name: "My Workspace",
          slug: "my-workspace",
          locale: "de",
        }),
      );
      expect(result).toMatchObject({ redirectTo: expect.any(String) });
    });

    it("leitet zum Workspace weiter mit korrektem Workspace-Slug", async () => {
      const result = await createWorkspace(
        makeFormData({
          name: "My Workspace",
          slug: "my-workspace",
          locale: "de",
        }),
      );
      expect((result as { redirectTo: string }).redirectTo).toBe(
        "/de/my-workspace",
      );
    });

    it("erstellt Workspace in einer Transaktion", async () => {
      await createWorkspace(
        makeFormData({ name: "My Workspace", slug: "my-workspace" }),
      );
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it("erstellt den User als Owner-Mitglied", async () => {
      await createWorkspace(
        makeFormData({ name: "My Workspace", slug: "my-workspace" }),
      );
      expect(mockTx.workspaceMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            role: "owner",
            pending: false,
          }),
        }),
      );
    });

    it("erstellt Standard-Statuses, Prioritäten, Typen und provisioniert RBAC", async () => {
      await createWorkspace(
        makeFormData({ name: "My Workspace", slug: "my-workspace" }),
      );
      expect(mockTx.workspaceStatus.createMany).toHaveBeenCalled();
      expect(mockTx.workspacePriority.createMany).toHaveBeenCalled();
      expect(mockTx.workspaceIssueType.createMany).toHaveBeenCalled();
      expect(mockProvisionRbac).toHaveBeenCalledWith(mockTx, "my-workspace");
    });

    it("erstellt ein initiales Projekt", async () => {
      await createWorkspace(
        makeFormData({ name: "My Workspace", slug: "my-workspace" }),
      );
      expect(mockTx.project.create).toHaveBeenCalledTimes(1);
    });
  });
});
