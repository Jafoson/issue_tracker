import { beforeEach, describe, expect, it, mock } from "bun:test";

// „Meine Aufgaben" zeigen dieselben Filter wie Board und Liste eines Projekts,
// nur über alle Projekte hinweg. Geprüft wird hier, was davon in der Abfrage
// ankommt — und vor allem, was ein Slug in der Adresse *nicht* verschieben darf.

mock.module("@/lib/db", () => ({
  db: {
    issue: { findMany: mock() },
    priority: { findMany: mock() },
    user: { findMany: mock() },
    label: { findMany: mock() },
    project: { findMany: mock() },
  },
}));

const mockAccessibleProjectIds = mock(async () => new Set(["p-1", "p-2"]));

mock.module("@/lib/permissions", () => ({
  accessibleProjectIds: mockAccessibleProjectIds,
  visibleProjectIds: mock(async () => new Set(["p-1", "p-2"])),
  currentUserCanEnterWorkspace: mock(async () => true),
  hasPermission: mock(async () => true),
}));

import { getMyIssues } from "@/features/issues/queries";
import { db } from "@/lib/db";

const issueFindMany = db.issue.findMany as ReturnType<typeof mock>;
const priorityFindMany = db.priority.findMany as ReturnType<typeof mock>;
const userFindMany = db.user.findMany as ReturnType<typeof mock>;
const labelFindMany = db.label.findMany as ReturnType<typeof mock>;
const projectFindMany = db.project.findMany as ReturnType<typeof mock>;

/** Die `where`-Bedingung des letzten `issue.findMany`-Aufrufs. */
function lastWhere(): Record<string, unknown> {
  const call = issueFindMany.mock.calls.at(-1)?.[0] as { where: object };
  return call.where as Record<string, unknown>;
}

describe("getMyIssues()", () => {
  beforeEach(() => {
    for (const m of [
      issueFindMany,
      priorityFindMany,
      userFindMany,
      labelFindMany,
      projectFindMany,
    ])
      m.mockReset();
    issueFindMany.mockResolvedValue([]);
    priorityFindMany.mockResolvedValue([]);
    userFindMany.mockResolvedValue([]);
    labelFindMany.mockResolvedValue([]);
    projectFindMany.mockResolvedValue([]);
  });

  it("sucht die eigenen Aufgaben in allen zugänglichen Projekten", async () => {
    await getMyIssues("u-1", "ws-1");

    expect(lastWhere()).toEqual({
      assigneeId: "u-1",
      projectId: { in: ["p-1", "p-2"] },
    });
    // Nach Rang wie im Projekt — sonst läge eine gezogene Zeile beim nächsten
    // Laden woanders.
    expect(issueFindMany.mock.calls.at(-1)?.[0].orderBy).toEqual([
      { rank: "asc" },
      { created: "asc" },
    ]);
  });

  it("übernimmt den Statusfilter aus der Adresse", async () => {
    await getMyIssues("u-1", "ws-1", { status: "todo,in_progress" });

    expect(lastWhere().status).toEqual({ in: ["todo", "in_progress"] });
  });

  it("lässt `?assignee=` die Zuständigkeit nicht überschreiben", async () => {
    userFindMany.mockResolvedValue([{ id: "u-2" }]);

    await getMyIssues("u-1", "ws-1", { assignee: "mara" });

    expect(lastWhere().assigneeId).toBe("u-1");
  });

  it("schneidet den Projektfilter in die zugänglichen Projekte hinein", async () => {
    // `p-3` ist nicht zugänglich — der Filter darf ihn nicht hereinholen.
    projectFindMany.mockResolvedValue([{ id: "p-2" }, { id: "p-3" }]);

    await getMyIssues("u-1", "ws-1", { project: "app,geheim" });

    expect(lastWhere().projectId).toEqual({ in: ["p-2"] });
  });

  it("fragt gar nicht erst, wenn der Projektfilter nichts Zugängliches trifft", async () => {
    projectFindMany.mockResolvedValue([{ id: "p-3" }]);

    expect(await getMyIssues("u-1", "ws-1", { project: "geheim" })).toEqual([]);
    expect(issueFindMany).not.toHaveBeenCalled();
  });

  it("übergeht einen Projekt-Slug, den es nicht gibt", async () => {
    projectFindMany.mockResolvedValue([]);

    await getMyIssues("u-1", "ws-1", { project: "gibtsnicht" });

    // Ein veralteter Link zeigt alles statt nichts — dieselbe Regel wie bei den
    // übrigen Filtern.
    expect(lastWhere().projectId).toEqual({ in: ["p-1", "p-2"] });
  });

  it("sucht in Titel, Beschreibungstext und Nummer", async () => {
    await getMyIssues("u-1", "ws-1", { q: "FUX-12" });

    expect(lastWhere().OR).toEqual([
      { title: { contains: "FUX-12", mode: "insensitive" } },
      { descriptionText: { contains: "FUX-12", mode: "insensitive" } },
      { key: 12 },
    ]);
  });
});
