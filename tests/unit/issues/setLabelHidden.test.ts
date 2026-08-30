import { beforeEach, describe, expect, it, mock } from "bun:test";

mock.module("@/lib/db", () => ({
  db: {
    label: { findUnique: mock() },
    project: { findUnique: mock() },
    projectHiddenLabel: { upsert: mock(), deleteMany: mock() },
  },
}));

const mockHasPermission = mock(async () => true);

mock.module("@/lib/permissions", () => ({
  requirePermission: mock(async () => "u1"),
  requirePermissionOr: mock(async () => "u1"),
  hasPermission: mockHasPermission,
  workspaceRoleKey: mock(async () => "owner"),
  PermissionError: class PermissionError extends Error {},
}));

mock.module("next/cache", () => ({
  revalidatePath: mock(),
}));

import { setLabelHidden } from "@/features/issues/actions";
import { db } from "@/lib/db";

const mockLabelFindUnique = db.label.findUnique as ReturnType<typeof mock>;
const mockProjectFindUnique = db.project.findUnique as ReturnType<typeof mock>;
const mockUpsert = db.projectHiddenLabel.upsert as ReturnType<typeof mock>;
const mockDeleteMany = db.projectHiddenLabel.deleteMany as ReturnType<
  typeof mock
>;

/** A workspace label — only these can be hidden within a project. */
const WORKSPACE_LABEL = { workspaceId: "ws-1", projectId: null };

describe("setLabelHidden()", () => {
  beforeEach(() => {
    mockLabelFindUnique.mockReset();
    mockProjectFindUnique.mockReset();
    mockUpsert.mockReset();
    mockDeleteMany.mockReset();
    mockHasPermission.mockReset();
    mockHasPermission.mockResolvedValue(true);

    mockLabelFindUnique.mockResolvedValue(WORKSPACE_LABEL);
    mockProjectFindUnique.mockResolvedValue({ workspaceId: "ws-1" });
  });

  it("creates a row when hiding", async () => {
    const result = await setLabelHidden("p-1", "l-1", true);

    expect(result).toEqual({ ok: true });
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { projectId_labelId: { projectId: "p-1", labelId: "l-1" } },
      create: { projectId: "p-1", labelId: "l-1" },
      update: {},
    });
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("removes the row again when unhiding", async () => {
    const result = await setLabelHidden("p-1", "l-1", false);

    expect(result).toEqual({ ok: true });
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { projectId: "p-1", labelId: "l-1" },
    });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("decides on label.update in the project scope", async () => {
    await setLabelHidden("p-1", "l-1", true);
    expect(mockHasPermission).toHaveBeenCalledWith("label.update", {
      projectId: "p-1",
    });
  });

  it("rejects whoever isn't allowed to manage labels in the project", async () => {
    mockHasPermission.mockResolvedValue(false);

    const result = await setLabelHidden("p-1", "l-1", true);

    expect(result).toHaveProperty("error");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  // A project label only ever applies within its own project anyway — there
  // it would need to be deleted, not hidden.
  it("rejects project labels", async () => {
    mockLabelFindUnique.mockResolvedValue({
      workspaceId: "ws-1",
      projectId: "p-1",
    });

    const result = await setLabelHidden("p-1", "l-1", true);

    expect(result).toHaveProperty("error");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  // Otherwise a foreign label id could be used to create a row in a tenant
  // that the label doesn't even belong to.
  it("rejects a label from another workspace", async () => {
    mockProjectFindUnique.mockResolvedValue({ workspaceId: "ws-2" });

    const result = await setLabelHidden("p-1", "l-1", true);

    expect(result).toHaveProperty("error");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("reports a deleted label instead of throwing", async () => {
    mockLabelFindUnique.mockResolvedValue(null);

    const result = await setLabelHidden("p-1", "l-1", true);

    expect(result).toHaveProperty("error");
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
