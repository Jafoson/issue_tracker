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

/** Ein Workspace-Label — nur solche lassen sich in einem Projekt ausblenden. */
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

  it("legt eine Zeile an, wenn ausgeblendet wird", async () => {
    const result = await setLabelHidden("p-1", "l-1", true);

    expect(result).toEqual({ ok: true });
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { projectId_labelId: { projectId: "p-1", labelId: "l-1" } },
      create: { projectId: "p-1", labelId: "l-1" },
      update: {},
    });
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("nimmt die Zeile wieder weg, wenn eingeblendet wird", async () => {
    const result = await setLabelHidden("p-1", "l-1", false);

    expect(result).toEqual({ ok: true });
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { projectId: "p-1", labelId: "l-1" },
    });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("entscheidet im Projekt-Scope über label.update", async () => {
    await setLabelHidden("p-1", "l-1", true);
    expect(mockHasPermission).toHaveBeenCalledWith("label.update", {
      projectId: "p-1",
    });
  });

  it("lehnt ab, wer im Projekt keine Labels pflegen darf", async () => {
    mockHasPermission.mockResolvedValue(false);

    const result = await setLabelHidden("p-1", "l-1", true);

    expect(result).toHaveProperty("error");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  // Ein Projekt-Label gilt ohnehin nur in seinem Projekt — dort wäre es zu
  // löschen, nicht auszublenden.
  it("lehnt Projekt-Labels ab", async () => {
    mockLabelFindUnique.mockResolvedValue({
      workspaceId: "ws-1",
      projectId: "p-1",
    });

    const result = await setLabelHidden("p-1", "l-1", true);

    expect(result).toHaveProperty("error");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  // Sonst ließe sich über eine fremde Label-ID eine Zeile in einem Mandanten
  // anlegen, zu dem das Label gar nicht gehört.
  it("lehnt ein Label aus einem anderen Workspace ab", async () => {
    mockProjectFindUnique.mockResolvedValue({ workspaceId: "ws-2" });

    const result = await setLabelHidden("p-1", "l-1", true);

    expect(result).toHaveProperty("error");
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("meldet ein gelöschtes Label zurück, statt zu werfen", async () => {
    mockLabelFindUnique.mockResolvedValue(null);

    const result = await setLabelHidden("p-1", "l-1", true);

    expect(result).toHaveProperty("error");
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
