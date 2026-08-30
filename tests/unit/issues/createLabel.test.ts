import { beforeEach, describe, expect, it, mock } from "bun:test";

mock.module("@/lib/db", () => ({
  db: {
    label: { create: mock(), findUnique: mock() },
    // A project label derives its workspace from the project, instead of
    // trusting the input.
    project: { findUnique: mock() },
  },
}));

mock.module("@/lib/permissions", () => ({
  requirePermission: mock(async () => "u1"),
  requirePermissionOr: mock(async () => "u1"),
  hasPermission: mock(async () => true),
  workspaceRoleKey: mock(async () => "owner"),
  PermissionError: class PermissionError extends Error {},
}));

mock.module("next/cache", () => ({
  revalidatePath: mock(),
}));

import { revalidatePath } from "next/cache";
import { createLabel } from "@/features/issues/actions";
import { db } from "@/lib/db";

const mockLabelCreate = db.label.create as ReturnType<typeof mock>;
const mockLabelFindUnique = db.label.findUnique as ReturnType<typeof mock>;
const mockProjectFindUnique = db.project.findUnique as ReturnType<typeof mock>;
const mockRevalidate = revalidatePath as ReturnType<typeof mock>;

const BASE = {
  name: "Bug",
  color: "#ef4444",
  workspaceId: "ws-1",
};

const DB_LABEL_WS = {
  id: "l-uuid",
  name: "Bug",
  slug: "bug",
  color: "#ef4444",
  workspaceId: "ws-1",
  projectId: null,
};

const DB_LABEL_PROJECT = {
  id: "l-uuid-2",
  name: "Feature",
  slug: "feature",
  color: "#6366f1",
  workspaceId: "ws-1",
  projectId: "proj-1",
};

describe("createLabel()", () => {
  beforeEach(() => {
    mockLabelCreate.mockReset();
    mockLabelFindUnique.mockReset();
    mockLabelFindUnique.mockResolvedValue(null); // slug is free
    mockProjectFindUnique.mockReset();
    mockProjectFindUnique.mockResolvedValue({ workspaceId: "ws-1" });
    mockRevalidate.mockReset();
  });

  describe("Workspace-wide label", () => {
    beforeEach(() => {
      mockLabelCreate.mockResolvedValue(DB_LABEL_WS);
    });

    it("creates a label with a workspace connect", async () => {
      await createLabel(BASE);
      expect(mockLabelCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Bug",
            color: "#ef4444",
            workspace: { connect: { id: "ws-1" } },
          }),
        }),
      );
    });

    it("contains no project field when no projectId is passed", async () => {
      await createLabel(BASE);
      const call = mockLabelCreate.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(call.data.project).toBeUndefined();
    });

    it("returns id, name, slug, color, and projectId null", async () => {
      const result = await createLabel(BASE);
      expect(result).toEqual({
        id: "l-uuid",
        name: "Bug",
        slug: "bug",
        color: "#ef4444",
        projectId: null,
      });
    });

    it("generates a slug from the name", async () => {
      await createLabel({ ...BASE, name: "Tech Debt" });
      const call = mockLabelCreate.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(call.data.slug).toBe("tech-debt");
    });

    it("appends a counter when the slug already exists", async () => {
      mockLabelFindUnique
        .mockResolvedValueOnce({ id: "existing" }) // "bug" taken
        .mockResolvedValueOnce(null); // "bug-2" free
      await createLabel(BASE);
      const call = mockLabelCreate.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(call.data.slug).toBe("bug-2");
    });

    it("calls revalidatePath", async () => {
      await createLabel(BASE);
      expect(mockRevalidate).toHaveBeenCalledWith("/", "layout");
    });
  });

  describe("Project-specific label", () => {
    beforeEach(() => {
      mockLabelCreate.mockResolvedValue(DB_LABEL_PROJECT);
    });

    it("creates a label with a project connect", async () => {
      await createLabel({
        ...BASE,
        name: "Feature",
        color: "#6366f1",
        projectId: "proj-1",
      });
      expect(mockLabelCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspace: { connect: { id: "ws-1" } },
            project: { connect: { id: "proj-1" } },
          }),
        }),
      );
    });

    it("returns the projectId", async () => {
      const result = await createLabel({
        ...BASE,
        name: "Feature",
        color: "#6366f1",
        projectId: "proj-1",
      });
      expect(result.projectId).toBe("proj-1");
    });

    // The call comes from the client and must not get to pick its own
    // workspace: the check happens on the project, so the write does too.
    it("takes the workspace from the project, not from the input", async () => {
      mockProjectFindUnique.mockResolvedValue({ workspaceId: "ws-echt" });

      await createLabel({
        ...BASE,
        workspaceId: "ws-fremd",
        projectId: "proj-1",
      });

      expect(mockLabelCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspace: { connect: { id: "ws-echt" } },
            project: { connect: { id: "proj-1" } },
          }),
        }),
      );
    });

    it("throws when the project doesn't exist", async () => {
      mockProjectFindUnique.mockResolvedValue(null);
      await expect(
        createLabel({ ...BASE, projectId: "proj-weg" }),
      ).rejects.toThrow();
      expect(mockLabelCreate).not.toHaveBeenCalled();
    });
  });

  describe("Label ID", () => {
    beforeEach(() => {
      mockLabelCreate.mockResolvedValue(DB_LABEL_WS);
    });

    it("passes a generated ID with prefix 'l'", async () => {
      await createLabel(BASE);
      const call = mockLabelCreate.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(call.data.id).toMatch(/^l/);
    });
  });
});
