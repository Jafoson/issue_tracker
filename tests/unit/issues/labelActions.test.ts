import { beforeEach, describe, expect, it, mock } from "bun:test";

mock.module("@/lib/db", () => ({
  db: {
    label: { findUnique: mock(), update: mock(), delete: mock() },
    issue: { findMany: mock(), update: mock() },
    project: { findUnique: mock() },
    // The transaction is handed finished Prisma promises. For the test all
    // that matters is that everything runs together in it — the mock just
    // passes them through.
    $transaction: mock(async (ops: unknown[]) => ops),
  },
}));

mock.module("@/lib/permissions", () => ({
  requirePermission: mock(async () => "u1"),
  requirePermissionOr: mock(async () => "u1"),
  hasPermission: mock(async () => true),
  PermissionError: class PermissionError extends Error {},
}));

mock.module("next/cache", () => ({
  revalidatePath: mock(),
}));

import { revalidatePath } from "next/cache";
import { deleteLabel, updateLabel } from "@/features/issues/actions";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

const mockLabelFindUnique = db.label.findUnique as ReturnType<typeof mock>;
const mockLabelUpdate = db.label.update as ReturnType<typeof mock>;
const mockLabelDelete = db.label.delete as ReturnType<typeof mock>;
const mockIssueFindMany = db.issue.findMany as ReturnType<typeof mock>;
const mockIssueUpdate = db.issue.update as ReturnType<typeof mock>;
const mockTransaction = db.$transaction as ReturnType<typeof mock>;
const mockHasPermission = hasPermission as ReturnType<typeof mock>;
const mockRevalidate = revalidatePath as ReturnType<typeof mock>;

const PROJECT_LABEL = {
  id: "l-1",
  workspaceId: "ws-1",
  projectId: "proj-1",
};

const WORKSPACE_LABEL = {
  id: "l-2",
  workspaceId: "ws-1",
  projectId: null,
};

beforeEach(() => {
  mockLabelFindUnique.mockReset();
  mockLabelFindUnique.mockResolvedValue(PROJECT_LABEL);
  mockLabelUpdate.mockReset();
  mockLabelUpdate.mockResolvedValue(PROJECT_LABEL);
  mockLabelDelete.mockReset();
  mockIssueFindMany.mockReset();
  mockIssueFindMany.mockResolvedValue([]);
  mockIssueUpdate.mockReset();
  mockTransaction.mockClear();
  mockHasPermission.mockReset();
  mockHasPermission.mockResolvedValue(true);
  mockRevalidate.mockReset();
});

describe("updateLabel()", () => {
  it("writes name and color", async () => {
    const result = await updateLabel("l-1", { name: "Fehler", color: "#f00" });

    expect(result).toEqual({ ok: true });
    expect(mockLabelUpdate).toHaveBeenCalledWith({
      where: { id: "l-1" },
      data: { name: "Fehler", color: "#f00" },
    });
  });

  it("trims whitespace from the name", async () => {
    await updateLabel("l-1", { name: "  Fehler  " });

    const call = mockLabelUpdate.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(call.data.name).toBe("Fehler");
  });

  it("leaves the slug untouched — it's embedded in filter URLs", async () => {
    await updateLabel("l-1", { name: "Ganz anders" });

    const call = mockLabelUpdate.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(call.data.slug).toBeUndefined();
  });

  it("writes only what was passed", async () => {
    await updateLabel("l-1", { color: "#0f0" });

    expect(mockLabelUpdate).toHaveBeenCalledWith({
      where: { id: "l-1" },
      data: { color: "#0f0" },
    });
  });

  it("rejects an empty name", async () => {
    const result = await updateLabel("l-1", { name: "   " });

    expect(result).toEqual({ error: "Name is required." });
    expect(mockLabelUpdate).not.toHaveBeenCalled();
  });

  it("reports a vanished label instead of throwing", async () => {
    mockLabelFindUnique.mockResolvedValue(null);

    const result = await updateLabel("l-weg", { name: "Fehler" });

    expect(result).toEqual({ error: "This label no longer exists." });
    expect(mockLabelUpdate).not.toHaveBeenCalled();
  });

  it("writes nothing without label.update", async () => {
    mockHasPermission.mockResolvedValue(false);

    const result = await updateLabel("l-1", { name: "Fehler" });

    expect(result).toHaveProperty("error");
    expect(mockLabelUpdate).not.toHaveBeenCalled();
  });

  // Same key, two levels: for a project label the project role decides,
  // for a workspace-wide one the workspace role does.
  it("checks a project label in the project scope", async () => {
    await updateLabel("l-1", { name: "Fehler" });

    expect(mockHasPermission).toHaveBeenCalledWith("label.update", {
      projectId: "proj-1",
    });
  });

  it("checks a workspace label in the workspace scope", async () => {
    mockLabelFindUnique.mockResolvedValue(WORKSPACE_LABEL);

    await updateLabel("l-2", { name: "Fehler" });

    expect(mockHasPermission).toHaveBeenCalledWith("label.update", {
      workspaceId: "ws-1",
    });
  });

  it("calls revalidatePath", async () => {
    await updateLabel("l-1", { name: "Fehler" });
    expect(mockRevalidate).toHaveBeenCalledWith("/", "layout");
  });
});

describe("deleteLabel()", () => {
  it("deletes the label", async () => {
    const result = await deleteLabel("l-1");

    expect(result).toEqual({ ok: true });
    expect(mockLabelDelete).toHaveBeenCalledWith({ where: { id: "l-1" } });
  });

  // `Issue.labels` is an ID array with no foreign key — if the ID were left
  // in place, it would point nowhere and the filters would keep counting it.
  it("removes the ID from the issues it's attached to", async () => {
    mockIssueFindMany.mockResolvedValue([
      { id: "i-1", labels: ["l-1", "l-9"] },
      { id: "i-2", labels: ["l-1"] },
    ]);

    await deleteLabel("l-1");

    expect(mockIssueUpdate).toHaveBeenCalledWith({
      where: { id: "i-1" },
      data: { labels: ["l-9"] },
    });
    expect(mockIssueUpdate).toHaveBeenCalledWith({
      where: { id: "i-2" },
      data: { labels: [] },
    });
  });

  it("cleans up and deletes in a single transaction", async () => {
    mockIssueFindMany.mockResolvedValue([{ id: "i-1", labels: ["l-1"] }]);

    await deleteLabel("l-1");

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    // One cleanup step per issue plus the deletion itself.
    expect(mockTransaction.mock.calls[0][0]).toHaveLength(2);
  });

  it("works fine with no affected issues", async () => {
    await deleteLabel("l-1");

    expect(mockIssueUpdate).not.toHaveBeenCalled();
    expect(mockLabelDelete).toHaveBeenCalled();
  });

  it("reports a vanished label instead of throwing", async () => {
    mockLabelFindUnique.mockResolvedValue(null);

    const result = await deleteLabel("l-weg");

    expect(result).toEqual({ error: "This label no longer exists." });
    expect(mockLabelDelete).not.toHaveBeenCalled();
  });

  it("deletes nothing without label.delete", async () => {
    mockHasPermission.mockResolvedValue(false);

    const result = await deleteLabel("l-1");

    expect(result).toHaveProperty("error");
    expect(mockLabelDelete).not.toHaveBeenCalled();
    expect(mockIssueFindMany).not.toHaveBeenCalled();
  });

  it("checks a workspace label in the workspace scope", async () => {
    mockLabelFindUnique.mockResolvedValue(WORKSPACE_LABEL);

    await deleteLabel("l-2");

    expect(mockHasPermission).toHaveBeenCalledWith("label.delete", {
      workspaceId: "ws-1",
    });
  });

  it("calls revalidatePath", async () => {
    await deleteLabel("l-1");
    expect(mockRevalidate).toHaveBeenCalledWith("/", "layout");
  });
});
