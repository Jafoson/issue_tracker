import { beforeEach, describe, expect, it, mock } from "bun:test";

mock.module("@/lib/db", () => ({
  db: {
    issue: { findUnique: mock(), update: mock(), create: mock() },
    project: { update: mock() },
  },
}));

mock.module("@/lib/permissions", () => ({
  requirePermission: mock(async () => "u1"),
  requirePermissionOr: mock(async () => "u1"),
  hasPermission: mock(async () => true),
  PermissionError: class PermissionError extends Error {},
}));

mock.module("next/cache", () => ({ revalidatePath: mock() }));

import { moveIssue, updateIssue } from "@/features/issues/actions";
import { db } from "@/lib/db";

const mockFindUnique = db.issue.findUnique as ReturnType<typeof mock>;
const mockUpdate = db.issue.update as ReturnType<typeof mock>;

/** Was an `db.issue.update` gereicht wurde. */
function written() {
  return mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
}

/** Der Stand einer Aufgabe, wie `issueContext` ihn liest. */
function issue(status: string, closedAt: Date | null) {
  return {
    projectId: "p1",
    reporterId: "u1",
    assigneeId: null,
    status,
    closedAt,
  };
}

const EARLIER = new Date("2026-01-05T10:00:00Z");

// `Issue.closedAt` ist die Grundlage von Durchsatz und Durchlaufzeit im
// Projekt-Dashboard. Anders als `updated` darf die Spalte sich nicht bei jeder
// späteren Änderung mitverschieben — und genau das ist die Sorte Fehler, die
// niemandem auffällt: das Diagramm zeigt weiter Säulen, nur an den falschen
// Tagen.

describe("Abschließen", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
  });

  it("setzt das Datum, wenn eine offene Aufgabe erledigt wird", async () => {
    mockFindUnique.mockResolvedValue(issue("in_progress", null));
    await moveIssue("i1", "done");

    expect(written().status).toBe("done");
    expect(written().closedAt).toBeInstanceOf(Date);
  });

  it("zählt auch das Verwerfen als Abschluss", async () => {
    mockFindUnique.mockResolvedValue(issue("todo", null));
    await moveIssue("i1", "canceled");

    expect(written().closedAt).toBeInstanceOf(Date);
  });

  it("nimmt das Datum wieder weg, wenn die Aufgabe erneut aufgemacht wird", async () => {
    // Ohne diesen Fall zählte das Dashboard sie für immer zum Durchsatz jenes
    // Tages, an dem sie einmal fertig war.
    mockFindUnique.mockResolvedValue(issue("done", EARLIER));
    await moveIssue("i1", "in_progress");

    expect(written().closedAt).toBeNull();
  });

  it("lässt das ursprüngliche Datum stehen, wenn Erledigt zu Verworfen wird", async () => {
    // Geschlossen wurde damals, umbenannt wurde nur, wie.
    mockFindUnique.mockResolvedValue(issue("done", EARLIER));
    await moveIssue("i1", "canceled");

    expect(written()).not.toHaveProperty("closedAt");
  });

  it("fasst das Datum nicht an, wenn der Status gleich bleibt", async () => {
    mockFindUnique.mockResolvedValue(issue("done", EARLIER));
    await updateIssue("i1", { title: "Neuer Titel" });

    expect(written()).not.toHaveProperty("closedAt");
    expect(written().title).toBe("Neuer Titel");
  });

  it("fasst es auch bei einem Wechsel zwischen zwei offenen Status nicht an", async () => {
    mockFindUnique.mockResolvedValue(issue("todo", null));
    await moveIssue("i1", "in_progress");

    expect(written()).not.toHaveProperty("closedAt");
  });
});
