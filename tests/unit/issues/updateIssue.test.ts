import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { PMDoc } from "@/lib/richtext/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const STATUSES: Record<string, { name: string; color: string }> = {
  todo: { name: "Offen", color: "#8a9099" },
  in_progress: { name: "In Arbeit", color: "#4c9aff" },
  done: { name: "Erledigt", color: "#36b37e" },
};
const PRIORITY_NAMES: Record<number, string> = { 2: "Mittel", 4: "Hoch" };
const TYPE_NAMES: Record<string, string> = { task: "Aufgabe", bug: "Fehler" };
const LABELS: Record<string, { name: string; color: string }> = {
  "l-a": { name: "Backend", color: "#6e63e6" },
  "l-b": { name: "Frontend", color: "#e66e9e" },
  "l-c": { name: "Bug", color: "#e6636e" },
};

const mockIssueFindUnique = mock();
const mockIssueUpdate = mock();
const mockUserFindUnique = mock();
const mockAuditCreate = mock();
const mockStatusFindUnique = mock();
const mockPriorityFindUnique = mock();
const mockIssueTypeFindUnique = mock();
const mockLabelFindMany = mock();

mock.module("@/lib/db", () => ({
  db: {
    issue: { findUnique: mockIssueFindUnique, update: mockIssueUpdate },
    user: { findUnique: mockUserFindUnique },
    auditLog: { create: mockAuditCreate },
    status: { findUnique: mockStatusFindUnique },
    priority: { findUnique: mockPriorityFindUnique },
    issueType: { findUnique: mockIssueTypeFindUnique },
    label: { findMany: mockLabelFindMany },
  },
}));

const mockRequirePermissionOr = mock(async () => ACTOR);
const mockRequirePermission = mock(async () => ACTOR);

mock.module("@/lib/permissions", () => ({
  requirePermission: mockRequirePermission,
  requirePermissionOr: mockRequirePermissionOr,
  hasPermission: mock(async () => true),
  currentUserId: mock(async () => ACTOR),
  PermissionError: class PermissionError extends Error {},
}));

const mockNotify = mock();
mock.module("@/lib/notify", () => ({ notify: mockNotify }));

mock.module("next/cache", () => ({ revalidatePath: mock() }));

import { moveIssue, updateIssue } from "@/features/issues/actions";

const ACTOR = "u-actor";
const ID = "i1";
const EMPTY_DOC: PMDoc = { type: "doc", content: [] };

/** Der Stand einer Aufgabe, wie `issueContext` ihn liest — Standardwerte, je
 * nach Test einzeln überschrieben. */
function issue(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    key: 1,
    projectId: "p1",
    reporterId: "u-reporter",
    assigneeId: null,
    status: "todo",
    priority: 2,
    type: "task",
    labels: ["l-a", "l-b"],
    closedAt: null,
    title: "Ursprünglicher Titel",
    description: EMPTY_DOC,
    project: { workspaceId: "ws1", prefix: "MOB" },
    ...overrides,
  };
}

function reset() {
  for (const m of [
    mockIssueFindUnique,
    mockIssueUpdate,
    mockUserFindUnique,
    mockAuditCreate,
    mockRequirePermissionOr,
    mockRequirePermission,
    mockNotify,
    mockStatusFindUnique,
    mockPriorityFindUnique,
    mockIssueTypeFindUnique,
    mockLabelFindMany,
  ]) {
    m.mockReset();
  }
  mockIssueUpdate.mockResolvedValue({});
  mockAuditCreate.mockResolvedValue({});
  mockRequirePermissionOr.mockResolvedValue(ACTOR);
  mockRequirePermission.mockResolvedValue(ACTOR);
  mockIssueFindUnique.mockResolvedValue(issue());

  // Namen für Statuszeile/Prioritätszeile/Typzeile/Labelzeile — dieselben
  // Nachschlagetabellen, gegen die `updateIssue` in echt fragt (`db.status`
  // u. a. sind ein geteilter, workspace-unabhängiger Katalog).
  mockStatusFindUnique.mockImplementation(
    async ({ where }: { where: { id: string } }) => STATUSES[where.id] ?? null,
  );
  mockPriorityFindUnique.mockImplementation(
    async ({ where }: { where: { id: number } }) => {
      const name = PRIORITY_NAMES[where.id];
      return name ? { name } : null;
    },
  );
  mockIssueTypeFindUnique.mockImplementation(
    async ({ where }: { where: { id: string } }) => {
      const name = TYPE_NAMES[where.id];
      return name ? { name } : null;
    },
  );
  mockLabelFindMany.mockImplementation(
    async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.map((id) => ({
        id,
        name: LABELS[id]?.name ?? id,
        color: LABELS[id]?.color ?? "#8a9099",
      })),
  );
}

describe("updateIssue() — Protokoll", () => {
  beforeEach(reset);

  it("protokolliert eine Zuweisung, mit Farbe für den Avatar", async () => {
    mockUserFindUnique.mockResolvedValue({
      firstName: "Ada",
      lastName: "Lovelace",
      color: "#ada-color",
    });

    await updateIssue(ID, { assignee: "u-ada" });

    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    const entry = mockAuditCreate.mock.calls[0][0].data;
    expect(entry).toMatchObject({
      action: "issue.assigned",
      actorId: ACTOR,
      targetType: "issue",
      targetId: ID,
      workspaceId: "ws1",
      projectId: "p1",
      personColor: "#ada-color",
    });
    expect(entry.targetLabel).toBe("MOB-1: Ada Lovelace");
  });

  it("protokolliert eine Umverteilung mit alter und neuer Person", async () => {
    mockIssueFindUnique.mockResolvedValue(issue({ assigneeId: "u-mara" }));
    mockUserFindUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) =>
        where.id === "u-mara"
          ? { firstName: "Mara", lastName: "Velez" }
          : { firstName: "Camila", lastName: "Santos", color: "#camila" },
    );

    await updateIssue(ID, { assignee: "u-camila" });

    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    const entry = mockAuditCreate.mock.calls[0][0].data;
    expect(entry.targetLabel).toBe("MOB-1: Mara Velez → Camila Santos");
    expect(entry.personColor).toBe("#camila");
  });

  it("protokolliert eine Entfernung der Zuweisung", async () => {
    mockIssueFindUnique.mockResolvedValue(issue({ assigneeId: "u-ada" }));

    await updateIssue(ID, { assignee: null });

    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditCreate.mock.calls[0][0].data).toMatchObject({
      action: "issue.unassigned",
      targetId: ID,
      targetLabel: "MOB-1",
    });
  });

  it("protokolliert nichts, wenn dieselbe Person erneut zugewiesen wird", async () => {
    mockIssueFindUnique.mockResolvedValue(issue({ assigneeId: "u-ada" }));

    await updateIssue(ID, { assignee: "u-ada" });

    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it("protokolliert eine Titeländerung mit alt und neu", async () => {
    await updateIssue(ID, { title: "Neuer Titel" });

    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    const entry = mockAuditCreate.mock.calls[0][0].data;
    expect(entry.action).toBe("issue.title.changed");
    expect(entry.targetLabel).toBe("MOB-1: Ursprünglicher Titel → Neuer Titel");
  });

  it("protokolliert nichts, wenn derselbe Titel erneut gespeichert wird", async () => {
    await updateIssue(ID, { title: "Ursprünglicher Titel" });
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it("protokolliert eine Beschreibungsänderung", async () => {
    const changed: PMDoc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hallo" }] },
      ],
    };

    await updateIssue(ID, { description: changed });

    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    const entry = mockAuditCreate.mock.calls[0][0].data;
    expect(entry.action).toBe("issue.description.changed");
    expect(entry.targetLabel).toBe("MOB-1");
  });

  it("protokolliert nichts, wenn dasselbe Dokument erneut gespeichert wird", async () => {
    await updateIssue(ID, { description: EMPTY_DOC });
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it("protokolliert einen Statuswechsel mit Namen und roh in meta", async () => {
    await updateIssue(ID, { status: "in_progress" });

    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    const entry = mockAuditCreate.mock.calls[0][0].data;
    expect(entry.action).toBe("issue.status.changed");
    expect(entry.targetLabel).toBe("MOB-1: Offen → In Arbeit");
    expect(entry.meta).toEqual({
      from: "todo",
      to: "in_progress",
      fromColor: "#8a9099",
      toColor: "#4c9aff",
    });
  });

  it("protokolliert eine Prioritätsänderung mit Namen und roh in meta", async () => {
    await updateIssue(ID, { priority: 4 });

    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    const entry = mockAuditCreate.mock.calls[0][0].data;
    expect(entry.action).toBe("issue.priority.changed");
    expect(entry.targetLabel).toBe("MOB-1: Mittel → Hoch");
    expect(entry.meta).toEqual({ from: 2, to: 4 });
  });

  it("protokolliert eine Typänderung mit Namen", async () => {
    await updateIssue(ID, { type: "bug" });

    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    const entry = mockAuditCreate.mock.calls[0][0].data;
    expect(entry.action).toBe("issue.type.changed");
    expect(entry.targetLabel).toBe("MOB-1: Aufgabe → Fehler");
  });

  it("protokolliert, welche Labels dazukamen und welche weg sind", async () => {
    await updateIssue(ID, { labels: ["l-a", "l-c"] });

    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    const entry = mockAuditCreate.mock.calls[0][0].data;
    expect(entry.action).toBe("issue.labels.changed");
    expect(entry.targetLabel).toBe("MOB-1: + Bug / − Frontend");
    expect(entry.meta).toEqual({
      added: [{ id: "l-c", name: "Bug", color: "#e6636e" }],
      removed: [{ id: "l-b", name: "Frontend", color: "#e66e9e" }],
    });
  });

  it("protokolliert nichts, wenn dieselben Labels nur anders sortiert ankommen", async () => {
    await updateIssue(ID, { labels: ["l-b", "l-a"] });
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it("protokolliert mehrere geänderte Aspekte als je eigene Zeile", async () => {
    await updateIssue(ID, { title: "Neuer Titel", priority: 4 });

    expect(mockAuditCreate).toHaveBeenCalledTimes(2);
    const actions = mockAuditCreate.mock.calls.map((c) => c[0].data.action);
    expect(actions.sort()).toEqual(
      ["issue.priority.changed", "issue.title.changed"].sort(),
    );
  });
});

describe("moveIssue() — Protokoll", () => {
  beforeEach(reset);

  it("protokolliert den Statuswechsel per Drag & Drop mit Namen", async () => {
    await moveIssue(ID, "done");

    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    const entry = mockAuditCreate.mock.calls[0][0].data;
    expect(entry.action).toBe("issue.status.changed");
    expect(entry.targetLabel).toBe("MOB-1: Offen → Erledigt");
    expect(entry.meta).toEqual({
      from: "todo",
      to: "done",
      fromColor: "#8a9099",
      toColor: "#36b37e",
    });
  });

  it("protokolliert nichts, wenn der Status gleich bleibt", async () => {
    await moveIssue(ID, "todo");
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });
});
