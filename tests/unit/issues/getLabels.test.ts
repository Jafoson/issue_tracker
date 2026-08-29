import { beforeEach, describe, expect, it, mock } from "bun:test";

mock.module("@/lib/db", () => ({
  db: {
    label: { findMany: mock() },
  },
}));

// React cache() just calls through in test environment
mock.module("react", () => ({
  cache: (fn: unknown) => fn,
}));

// Project labels depend on the project's visibility — this sets up the
// default state "p-1 is visible".
const mockVisibleProjectIds = mock(async () => new Set(["p-1"]));

mock.module("@/lib/permissions", () => ({
  visibleProjectIds: mockVisibleProjectIds,
  accessibleProjectIds: mock(async () => new Set(["p-1"])),
  currentUserCanEnterWorkspace: mock(async () => true),
  hasPermission: mock(async () => true),
}));

import { getLabels } from "@/features/issues/queries";
import { db } from "@/lib/db";

const mockLabelFindMany = db.label.findMany as ReturnType<typeof mock>;

describe("getLabels()", () => {
  beforeEach(() => {
    mockLabelFindMany.mockReset();
  });

  it("sucht Labels nach workspaceId sortiert nach Name", async () => {
    mockLabelFindMany.mockResolvedValue([]);
    await getLabels("ws-1");
    expect(mockLabelFindMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws-1",
        // Workspace labels always, project labels only from visible projects.
        OR: [{ projectId: null }, { projectId: { in: ["p-1"] } }],
      },
      orderBy: { name: "asc" },
      // Where a label is hidden comes along too — the picker on the issue
      // only knows this one list.
      include: { hiddenIn: { select: { projectId: true } } },
    });
  });

  it("lässt Projekt-Labels unsichtbarer Projekte weg", async () => {
    mockVisibleProjectIds.mockResolvedValueOnce(new Set<string>());
    mockLabelFindMany.mockResolvedValue([]);
    await getLabels("ws-1");
    expect(mockLabelFindMany.mock.calls[0][0].where.OR).toEqual([
      { projectId: null },
      { projectId: { in: [] } },
    ]);
  });

  it("mappt DB-Rows auf Label-Objekte mit projectId", async () => {
    mockLabelFindMany.mockResolvedValue([
      {
        id: "l-1",
        name: "Bug",
        slug: "bug",
        color: "#ef4444",
        workspaceId: "ws-1",
        projectId: null,
        hiddenIn: [{ projectId: "p-2" }],
      },
      {
        id: "l-2",
        name: "Feature",
        slug: "feature",
        color: "#6366f1",
        workspaceId: "ws-1",
        projectId: "p-1",
        hiddenIn: [],
      },
    ]);

    const result = await getLabels("ws-1");

    expect(result).toEqual([
      {
        id: "l-1",
        name: "Bug",
        slug: "bug",
        color: "#ef4444",
        projectId: null,
        // A workspace label that p-2 has hidden for itself: everywhere else
        // it remains available for selection.
        hiddenIn: ["p-2"],
      },
      {
        id: "l-2",
        name: "Feature",
        slug: "feature",
        color: "#6366f1",
        projectId: "p-1",
        hiddenIn: [],
      },
    ]);
  });

  it("gibt projectId als null zurück wenn das Feld in DB null ist", async () => {
    mockLabelFindMany.mockResolvedValue([
      {
        id: "l-1",
        name: "Bug",
        slug: "bug",
        color: "#ef4444",
        workspaceId: "ws-1",
        projectId: null,
        hiddenIn: [],
      },
    ]);

    const [label] = await getLabels("ws-1");
    expect(label.projectId).toBeNull();
  });

  it("gibt leeres Array zurück wenn keine Labels vorhanden", async () => {
    mockLabelFindMany.mockResolvedValue([]);
    const result = await getLabels("ws-1");
    expect(result).toEqual([]);
  });
});
