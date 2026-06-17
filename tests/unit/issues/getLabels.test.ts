import { describe, it, expect, mock, beforeEach } from "bun:test";

mock.module("@/lib/db", () => ({
  db: {
    label: { findMany: mock() },
  },
}));

// React cache() just calls through in test environment
mock.module("react", () => ({
  cache: (fn: unknown) => fn,
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
      where:   { workspaceId: "ws-1" },
      orderBy: { name: "asc" },
    });
  });

  it("mappt DB-Rows auf Label-Objekte mit projectId", async () => {
    mockLabelFindMany.mockResolvedValue([
      { id: "l-1", name: "Bug",     color: "#ef4444", workspaceId: "ws-1", projectId: null    },
      { id: "l-2", name: "Feature", color: "#6366f1", workspaceId: "ws-1", projectId: "p-1"  },
    ]);

    const result = await getLabels("ws-1");

    expect(result).toEqual([
      { id: "l-1", name: "Bug",     color: "#ef4444", projectId: null  },
      { id: "l-2", name: "Feature", color: "#6366f1", projectId: "p-1" },
    ]);
  });

  it("gibt projectId als null zurück wenn das Feld in DB null ist", async () => {
    mockLabelFindMany.mockResolvedValue([
      { id: "l-1", name: "Bug", color: "#ef4444", workspaceId: "ws-1", projectId: null },
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
