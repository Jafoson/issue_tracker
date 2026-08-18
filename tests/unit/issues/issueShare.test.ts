import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockIssueFindUnique = mock();
const mockIssueUpdate = mock();
const mockUserFindUnique = mock();
const mockAuditCreate = mock();
const mockStatusFindMany = mock();
const mockPriorityFindMany = mock();
const mockIssueTypeFindMany = mock();
const mockLabelFindMany = mock();

mock.module("@/lib/db", () => ({
  db: {
    issue: { findUnique: mockIssueFindUnique, update: mockIssueUpdate },
    user: { findUnique: mockUserFindUnique },
    auditLog: { create: mockAuditCreate },
    status: { findMany: mockStatusFindMany },
    priority: { findMany: mockPriorityFindMany },
    issueType: { findMany: mockIssueTypeFindMany },
    label: { findMany: mockLabelFindMany },
  },
}));

class PermissionError extends Error {}

const mockRequirePermission = mock(async () => ACTOR);

mock.module("@/lib/permissions", () => ({
  requirePermission: mockRequirePermission,
  requirePermissionOr: mock(async () => ACTOR),
  hasPermission: mock(async () => true),
  currentUserId: mock(async () => ACTOR),
  accessFor: mock(),
  PermissionError,
}));

mock.module("next/cache", () => ({ revalidatePath: mock() }));

const mockNotify = mock();
mock.module("@/lib/notify", () => ({ notify: mockNotify }));

import {
  disableIssueShare,
  enableIssueShare,
  shareIssueByEmail,
  shareIssueWithMember,
} from "@/features/issues/actions";
import { getIssueByShareToken } from "@/features/issues/queries";

const ACTOR = "u-actor";
const ID = "i1";
const TOKEN = "share-token-abc";

function baseIssue(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    key: 1,
    projectId: "p1",
    reporterId: "u-reporter",
    assigneeId: null,
    status: "todo",
    priority: 2,
    type: "task",
    labels: [],
    closedAt: null,
    title: "Ein Titel",
    description: { type: "doc", content: [] },
    shareToken: null,
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
    mockStatusFindMany,
    mockPriorityFindMany,
    mockIssueTypeFindMany,
    mockLabelFindMany,
    mockRequirePermission,
    mockNotify,
  ]) {
    m.mockReset();
  }

  mockRequirePermission.mockImplementation(async () => ACTOR);
  mockIssueFindUnique.mockResolvedValue(baseIssue());
  mockIssueUpdate.mockResolvedValue({});
  mockAuditCreate.mockResolvedValue({});
  mockStatusFindMany.mockResolvedValue([]);
  mockPriorityFindMany.mockResolvedValue([]);
  mockIssueTypeFindMany.mockResolvedValue([]);
  mockLabelFindMany.mockResolvedValue([]);
  mockNotify.mockResolvedValue(undefined);
}

describe("enableIssueShare()", () => {
  beforeEach(reset);

  it("verlangt issue.share.manage im Projekt", async () => {
    mockRequirePermission.mockImplementation(() => {
      throw new PermissionError("issue.share.manage");
    });
    await expect(enableIssueShare(ID)).rejects.toThrow(PermissionError);
    expect(mockIssueUpdate).not.toHaveBeenCalled();
  });

  it("prüft im Kontext des Projekts", async () => {
    await enableIssueShare(ID);
    expect(mockRequirePermission).toHaveBeenCalledWith("issue.share.manage", {
      projectId: "p1",
    });
  });

  it("setzt einen neuen Token und gibt die URL zurück", async () => {
    const result = await enableIssueShare(ID);

    expect(result.ok).toBe(true);
    expect(result.url).toContain("/share/");
    expect(mockIssueUpdate).toHaveBeenCalledWith({
      where: { id: ID },
      data: { shareToken: expect.any(String) },
    });
  });

  it("protokolliert das Aktivieren", async () => {
    await enableIssueShare(ID);
    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditCreate.mock.calls[0][0].data.action).toBe("issue.shared");
  });
});

describe("disableIssueShare()", () => {
  beforeEach(reset);

  it("verlangt issue.share.manage im Projekt", async () => {
    mockRequirePermission.mockImplementation(() => {
      throw new PermissionError("issue.share.manage");
    });
    await expect(disableIssueShare(ID)).rejects.toThrow(PermissionError);
    expect(mockIssueUpdate).not.toHaveBeenCalled();
  });

  it("löscht den Token", async () => {
    const result = await disableIssueShare(ID);

    expect(result).toEqual({ ok: true });
    expect(mockIssueUpdate).toHaveBeenCalledWith({
      where: { id: ID },
      data: { shareToken: null },
    });
  });

  it("protokolliert das Widerrufen", async () => {
    await disableIssueShare(ID);
    expect(mockAuditCreate.mock.calls[0][0].data.action).toBe(
      "issue.share.revoked",
    );
  });
});

describe("shareIssueWithMember()", () => {
  beforeEach(reset);

  it("verlangt issue.share.manage im Projekt", async () => {
    mockRequirePermission.mockImplementation(() => {
      throw new PermissionError("issue.share.manage");
    });
    await expect(shareIssueWithMember(ID, "u-target")).rejects.toThrow(
      PermissionError,
    );
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("benachrichtigt die ausgewählte Person mit dem Anlass issueShared", async () => {
    await shareIssueWithMember(ID, "u-target", "Schau mal rein");

    expect(mockNotify).toHaveBeenCalledWith({
      userId: "u-target",
      type: "issueShared",
      actorId: ACTOR,
      workspaceId: "ws1",
      projectId: "p1",
      issueId: ID,
      text: "Schau mal rein",
    });
  });

  it("ohne Nachricht bleibt text leer", async () => {
    await shareIssueWithMember(ID, "u-target");
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ text: "" }),
    );
  });
});

describe("shareIssueByEmail()", () => {
  beforeEach(reset);

  it("verlangt issue.share.manage im Projekt", async () => {
    mockRequirePermission.mockImplementation(() => {
      throw new PermissionError("issue.share.manage");
    });
    await expect(shareIssueByEmail(ID, "mara@example.com")).rejects.toThrow(
      PermissionError,
    );
    expect(mockIssueUpdate).not.toHaveBeenCalled();
  });

  it("lehnt eine ungültige E-Mail-Adresse ab", async () => {
    const result = await shareIssueByEmail(ID, "not-an-email");
    expect(result).toEqual({ error: expect.any(String) });
    expect(mockIssueUpdate).not.toHaveBeenCalled();
  });

  it("schaltet den Link mit ein, wenn er noch aus ist", async () => {
    const result = await shareIssueByEmail(ID, "mara@example.com");

    expect(result).toEqual({ ok: true, url: expect.any(String) });
    expect(mockIssueUpdate).toHaveBeenCalledWith({
      where: { id: ID },
      data: { shareToken: expect.any(String) },
    });
    expect(mockAuditCreate.mock.calls[0][0].data.action).toBe("issue.shared");
  });

  it("erzeugt keinen neuen Token, wenn schon einer aktiv ist", async () => {
    mockIssueFindUnique.mockResolvedValue(
      baseIssue({ shareToken: "existing-token" }),
    );

    const result = await shareIssueByEmail(ID, "mara@example.com");

    expect(result).toEqual({
      ok: true,
      url: expect.stringContaining("existing-token"),
    });
    expect(mockIssueUpdate).not.toHaveBeenCalled();
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });
});

describe("getIssueByShareToken()", () => {
  beforeEach(reset);

  it("liefert null für einen unbekannten Token", async () => {
    mockIssueFindUnique.mockResolvedValue(null);
    expect(await getIssueByShareToken(TOKEN)).toBeNull();
  });

  it("liefert null für einen leeren Token", async () => {
    expect(await getIssueByShareToken("")).toBeNull();
    expect(mockIssueFindUnique).not.toHaveBeenCalled();
  });

  it("liefert eine minimale Projektion ohne Zugriffsfelder", async () => {
    mockIssueFindUnique.mockResolvedValue({
      title: "Öffentliches Issue",
      description: { type: "doc", content: [] },
      status: "todo",
      priority: 2,
      type: "task",
      labels: ["l-a"],
      project: {
        name: "Mobile",
        workspaceId: "ws1",
        workspace: { name: "Nimbus" },
      },
      comments: [
        {
          id: "c1",
          body: { type: "doc", content: [] },
          created: new Date("2026-01-01"),
          author: { firstName: "Ada", lastName: "Lovelace" },
        },
      ],
    });
    mockStatusFindMany.mockResolvedValue([
      {
        id: "todo",
        name: "Offen",
        short: "TODO",
        color: "#8a9099",
        position: 0,
      },
    ]);
    mockLabelFindMany.mockResolvedValue([
      { id: "l-a", name: "Backend", color: "#6e63e6" },
    ]);

    const result = await getIssueByShareToken(TOKEN);

    expect(result).not.toBeNull();
    expect(result?.title).toBe("Öffentliches Issue");
    expect(result?.workspaceName).toBe("Nimbus");
    expect(result?.projectName).toBe("Mobile");
    expect(result?.status).toEqual({ name: "Offen", color: "#8a9099" });
    expect(result?.labels).toEqual([
      { id: "l-a", name: "Backend", color: "#6e63e6" },
    ]);
    expect(result?.comments[0]).toMatchObject({
      id: "c1",
      authorName: "Ada Lovelace",
    });
    // Keine Bearbeitungs- oder Zugriffsfelder in der öffentlichen Projektion.
    expect(result).not.toHaveProperty("access");
    expect(result).not.toHaveProperty("assignee");
  });
});
