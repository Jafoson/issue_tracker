import { beforeEach, describe, expect, it, mock } from "bun:test";

mock.module("@/lib/db", () => ({
  db: {
    issue: { findUnique: mock(), update: mock(), create: mock() },
    project: { update: mock() },
    user: { findUnique: mock() },
    auditLog: { create: mock(async () => ({})) },
    // Not the subject of this file — `moveIssue`/`updateIssue` look up names
    // for these when status/priority/type/labels change (audit trail,
    // `recordIssueAudit` & co.). `null` is a valid result (unknown id), in
    // which case the row falls back to the raw id.
    status: { findUnique: mock(async () => null) },
    priority: { findUnique: mock(async () => null) },
    issueType: { findUnique: mock(async () => null) },
    label: { findMany: mock(async () => []) },
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

/** What was passed to `db.issue.update`. */
function written() {
  return mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
}

/** The state of an issue, as `issueContext` reads it. */
function issue(status: string, closedAt: Date | null) {
  return {
    projectId: "p1",
    reporterId: "u1",
    assigneeId: null,
    status,
    priority: 2,
    type: "task",
    labels: [] as string[],
    closedAt,
    title: "Titel",
    description: null,
    project: { workspaceId: "ws1" },
  };
}

const EARLIER = new Date("2026-01-05T10:00:00Z");

// `Issue.closedAt` is the basis for throughput and cycle time in the
// project dashboard. Unlike `updated`, this column must not drift along
// with every later change — and that's exactly the kind of bug nobody
// notices: the chart keeps showing bars, just on the wrong days.

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
    // Without this case, the dashboard would count it toward the throughput
    // of the day it was once finished, forever.
    mockFindUnique.mockResolvedValue(issue("done", EARLIER));
    await moveIssue("i1", "in_progress");

    expect(written().closedAt).toBeNull();
  });

  it("lässt das ursprüngliche Datum stehen, wenn Erledigt zu Verworfen wird", async () => {
    // It was closed back then; only how it's labeled has changed.
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
