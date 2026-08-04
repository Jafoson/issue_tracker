import { beforeEach, describe, expect, it, mock } from "bun:test";

mock.module("@/lib/db", () => ({
  db: {
    label: { create: mock(), findUnique: mock() },
    // Ein Projekt-Label leitet seinen Workspace aus dem Projekt ab, statt der
    // Eingabe zu glauben.
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

  describe("Workspace-weites Label", () => {
    beforeEach(() => {
      mockLabelCreate.mockResolvedValue(DB_LABEL_WS);
    });

    it("legt ein Label mit workspace connect an", async () => {
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

    it("enthält kein project-Feld wenn kein projectId übergeben", async () => {
      await createLabel(BASE);
      const call = mockLabelCreate.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(call.data.project).toBeUndefined();
    });

    it("gibt id, name, slug, color und projectId null zurück", async () => {
      const result = await createLabel(BASE);
      expect(result).toEqual({
        id: "l-uuid",
        name: "Bug",
        slug: "bug",
        color: "#ef4444",
        projectId: null,
      });
    });

    it("generiert einen Slug aus dem Namen", async () => {
      await createLabel({ ...BASE, name: "Tech Debt" });
      const call = mockLabelCreate.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(call.data.slug).toBe("tech-debt");
    });

    it("hängt einen Zähler an wenn der Slug bereits existiert", async () => {
      mockLabelFindUnique
        .mockResolvedValueOnce({ id: "existing" }) // "bug" taken
        .mockResolvedValueOnce(null); // "bug-2" free
      await createLabel(BASE);
      const call = mockLabelCreate.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(call.data.slug).toBe("bug-2");
    });

    it("ruft revalidatePath auf", async () => {
      await createLabel(BASE);
      expect(mockRevalidate).toHaveBeenCalledWith("/", "layout");
    });
  });

  describe("Projektspezifisches Label", () => {
    beforeEach(() => {
      mockLabelCreate.mockResolvedValue(DB_LABEL_PROJECT);
    });

    it("legt ein Label mit project connect an", async () => {
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

    it("gibt die projectId zurück", async () => {
      const result = await createLabel({
        ...BASE,
        name: "Feature",
        color: "#6366f1",
        projectId: "proj-1",
      });
      expect(result.projectId).toBe("proj-1");
    });

    // Der Aufruf kommt aus dem Client und darf sich seinen Workspace nicht
    // aussuchen: geprüft wird im Projekt, geschrieben wird deshalb auch dort.
    it("nimmt den Workspace aus dem Projekt, nicht aus der Eingabe", async () => {
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

    it("wirft, wenn das Projekt nicht existiert", async () => {
      mockProjectFindUnique.mockResolvedValue(null);
      await expect(
        createLabel({ ...BASE, projectId: "proj-weg" }),
      ).rejects.toThrow();
      expect(mockLabelCreate).not.toHaveBeenCalled();
    });
  });

  describe("Label-ID", () => {
    beforeEach(() => {
      mockLabelCreate.mockResolvedValue(DB_LABEL_WS);
    });

    it("übergibt eine generierte ID mit Präfix 'l'", async () => {
      await createLabel(BASE);
      const call = mockLabelCreate.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(call.data.id).toMatch(/^l/);
    });
  });
});
