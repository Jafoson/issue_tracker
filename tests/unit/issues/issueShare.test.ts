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

  it("requires issue.share.manage in the project", async () => {
    mockRequirePermission.mockImplementation(() => {
      throw new PermissionError("issue.share.manage");
    });
    await expect(enableIssueShare(ID)).rejects.toThrow(PermissionError);
    expect(mockIssueUpdate).not.toHaveBeenCalled();
  });

  it("checks in the context of the project", async () => {
    await enableIssueShare(ID);
    expect(mockRequirePermission).toHaveBeenCalledWith("issue.share.manage", {
      projectId: "p1",
    });
  });

  it("sets a new token and returns the URL", async () => {
    const result = await enableIssueShare(ID);

    expect(result.ok).toBe(true);
    expect(result.url).toContain("/share/");
    expect(mockIssueUpdate).toHaveBeenCalledWith({
      where: { id: ID },
      data: {
        shareToken: expect.any(String),
        shareTokenCreatedAt: expect.any(Date),
        shareTokenCreatedById: ACTOR,
        shareTokenExpiresAt: expect.any(Date),
      },
    });
  });

  it("logs the activation", async () => {
    await enableIssueShare(ID);
    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditCreate.mock.calls[0][0].data.action).toBe("issue.shared");
  });
});

describe("disableIssueShare()", () => {
  beforeEach(reset);

  it("requires issue.share.manage in the project", async () => {
    mockRequirePermission.mockImplementation(() => {
      throw new PermissionError("issue.share.manage");
    });
    await expect(disableIssueShare(ID)).rejects.toThrow(PermissionError);
    expect(mockIssueUpdate).not.toHaveBeenCalled();
  });

  it("deletes the token and its metadata", async () => {
    const result = await disableIssueShare(ID);

    expect(result).toEqual({ ok: true });
    expect(mockIssueUpdate).toHaveBeenCalledWith({
      where: { id: ID },
      data: {
        shareToken: null,
        shareTokenCreatedAt: null,
        shareTokenExpiresAt: null,
        shareTokenCreatedById: null,
      },
    });
  });

  it("logs the revocation", async () => {
    await disableIssueShare(ID);
    expect(mockAuditCreate.mock.calls[0][0].data.action).toBe(
      "issue.share.revoked",
    );
  });
});

describe("shareIssueWithMember()", () => {
  beforeEach(reset);

  it("requires issue.share.manage in the project", async () => {
    mockRequirePermission.mockImplementation(() => {
      throw new PermissionError("issue.share.manage");
    });
    await expect(shareIssueWithMember(ID, "u-target")).rejects.toThrow(
      PermissionError,
    );
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("notifies the selected person with the issueShared event", async () => {
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

  it("text stays empty without a message", async () => {
    await shareIssueWithMember(ID, "u-target");
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ text: "" }),
    );
  });
});

describe("shareIssueByEmail()", () => {
  beforeEach(reset);

  it("requires issue.share.manage in the project", async () => {
    mockRequirePermission.mockImplementation(() => {
      throw new PermissionError("issue.share.manage");
    });
    await expect(shareIssueByEmail(ID, "mara@example.com")).rejects.toThrow(
      PermissionError,
    );
    expect(mockIssueUpdate).not.toHaveBeenCalled();
  });

  it("rejects an invalid email address", async () => {
    const result = await shareIssueByEmail(ID, "not-an-email");
    expect(result).toEqual({ error: expect.any(String) });
    expect(mockIssueUpdate).not.toHaveBeenCalled();
  });

  it("turns the link on when it's still off", async () => {
    const result = await shareIssueByEmail(ID, "mara@example.com");

    expect(result).toEqual({ ok: true, url: expect.any(String) });
    expect(mockIssueUpdate).toHaveBeenCalledWith({
      where: { id: ID },
      data: {
        shareToken: expect.any(String),
        shareTokenCreatedAt: expect.any(Date),
        shareTokenCreatedById: ACTOR,
        shareTokenExpiresAt: expect.any(Date),
      },
    });
    expect(mockAuditCreate.mock.calls[0][0].data.action).toBe("issue.shared");
  });

  it("doesn't create a new token when one without an expiry date is already active", async () => {
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

  it("doesn't create a new token when the active one hasn't expired yet", async () => {
    mockIssueFindUnique.mockResolvedValue(
      baseIssue({
        shareToken: "existing-token",
        shareTokenExpiresAt: new Date(Date.now() + 60_000),
      }),
    );

    const result = await shareIssueByEmail(ID, "mara@example.com");

    expect(result).toEqual({
      ok: true,
      url: expect.stringContaining("existing-token"),
    });
    expect(mockIssueUpdate).not.toHaveBeenCalled();
  });

  it("creates a new token when the active one has already expired", async () => {
    mockIssueFindUnique.mockResolvedValue(
      baseIssue({
        shareToken: "expired-token",
        shareTokenExpiresAt: new Date(Date.now() - 60_000),
      }),
    );

    const result = await shareIssueByEmail(ID, "mara@example.com");

    expect("ok" in result && result.ok).toBe(true);
    expect(mockIssueUpdate).toHaveBeenCalledWith({
      where: { id: ID },
      data: {
        shareToken: expect.any(String),
        shareTokenCreatedAt: expect.any(Date),
        shareTokenCreatedById: ACTOR,
        shareTokenExpiresAt: expect.any(Date),
      },
    });
    if ("url" in result) {
      expect(result.url).not.toContain("expired-token");
    }
  });
});

describe("getIssueByShareToken()", () => {
  beforeEach(reset);

  it("returns null for an unknown token", async () => {
    mockIssueFindUnique.mockResolvedValue(null);
    expect(await getIssueByShareToken(TOKEN)).toBeNull();
  });

  it("returns null for an empty token", async () => {
    expect(await getIssueByShareToken("")).toBeNull();
    expect(mockIssueFindUnique).not.toHaveBeenCalled();
  });

  function shareableIssue(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      key: 42,
      title: "Öffentliches Issue",
      description: { type: "doc", content: [] },
      status: "todo",
      priority: 2,
      type: "task",
      labels: ["l-a"],
      created: new Date("2026-01-01"),
      updated: new Date("2026-01-05"),
      shareTokenCreatedAt: new Date("2026-01-04"),
      shareTokenExpiresAt: null,
      assignee: {
        firstName: "Priya",
        lastName: "Nair",
        color: "#e05252",
        image: null,
      },
      reporter: {
        firstName: "Tomas",
        lastName: "Køhler",
        color: "#3b7bd5",
        image: null,
      },
      sharedBy: {
        firstName: "Jonas",
        lastName: "Reuter",
        color: "#a274d9",
        image: null,
      },
      project: {
        name: "Mobile",
        prefix: "MOB",
        workspaceId: "ws1",
        workspace: { name: "Nimbus" },
      },
      comments: [
        {
          id: "c1",
          body: { type: "doc", content: [] },
          created: new Date("2026-01-01"),
          author: {
            firstName: "Ada",
            lastName: "Lovelace",
            color: "#5ab98a",
            image: null,
          },
        },
      ],
      ...overrides,
    };
  }

  it("returns a minimal projection without access-control fields", async () => {
    mockIssueFindUnique.mockResolvedValue(shareableIssue());
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
    expect(result?.identifier).toBe("MOB-42");
    expect(result?.title).toBe("Öffentliches Issue");
    expect(result?.workspaceName).toBe("Nimbus");
    expect(result?.projectName).toBe("Mobile");
    expect(result?.status).toEqual({ name: "Offen", color: "#8a9099" });
    expect(result?.labels).toEqual([
      { id: "l-a", name: "Backend", color: "#6e63e6" },
    ]);
    expect(result?.assignee).toMatchObject({ firstName: "Priya" });
    expect(result?.reporter).toMatchObject({ firstName: "Tomas" });
    expect(result?.sharedBy).toMatchObject({ firstName: "Jonas" });
    expect(result?.comments[0]).toMatchObject({
      id: "c1",
      author: { firstName: "Ada", lastName: "Lovelace" },
    });
    // No editing or access-control fields in the public projection.
    expect(result).not.toHaveProperty("access");
  });

  it("returns null for an expired token", async () => {
    mockIssueFindUnique.mockResolvedValue(
      shareableIssue({ shareTokenExpiresAt: new Date("2020-01-01") }),
    );
    mockStatusFindMany.mockResolvedValue([]);
    mockLabelFindMany.mockResolvedValue([]);

    expect(
      await getIssueByShareToken(TOKEN, new Date("2026-01-01")),
    ).toBeNull();
  });

  it("stays valid without an assignee", async () => {
    mockIssueFindUnique.mockResolvedValue(shareableIssue({ assignee: null }));
    mockStatusFindMany.mockResolvedValue([]);
    mockLabelFindMany.mockResolvedValue([]);

    const result = await getIssueByShareToken(TOKEN);
    expect(result?.assignee).toBeNull();
  });
});
