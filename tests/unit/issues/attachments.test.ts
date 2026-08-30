import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const ACTOR = "u-actor";
const ISSUE_ID = "i1";

const mockIssueFindUnique = mock();
const mockAttachmentCreate = mock();
const mockAttachmentFindUnique = mock();
const mockAttachmentDelete = mock();

mock.module("@/lib/db", () => ({
  db: {
    issue: { findUnique: mockIssueFindUnique },
    attachment: {
      create: mockAttachmentCreate,
      findUnique: mockAttachmentFindUnique,
      delete: mockAttachmentDelete,
    },
  },
}));

const mockRequirePermissionOr = mock(async () => ACTOR);
mock.module("@/lib/permissions", () => ({
  requirePermissionOr: mockRequirePermissionOr,
  PermissionError: class PermissionError extends Error {},
}));

const mockRequestAttachmentUpload = mock();
const mockFinalizeAttachmentUpload = mock();
const mockResolveAttachmentUrl = mock();
const mockDeleteAttachmentObject = mock();
mock.module("@/lib/storage", () => ({
  requestAttachmentUpload: mockRequestAttachmentUpload,
  finalizeAttachmentUpload: mockFinalizeAttachmentUpload,
  resolveAttachmentUrl: mockResolveAttachmentUrl,
  deleteAttachmentObject: mockDeleteAttachmentObject,
}));

mock.module("next/cache", () => ({ revalidatePath: mock() }));

import {
  addIssueLinkAttachment,
  confirmIssueAttachmentUpload,
  deleteIssueAttachment,
  requestIssueAttachmentUpload,
} from "@/features/issues/actions";

/** The state of an issue, as `issueContext` reads it. */
function issueRow(overrides: Partial<Record<string, unknown>> = {}) {
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
    title: "Titel",
    description: { type: "doc", content: [] },
    shareToken: null,
    shareTokenExpiresAt: null,
    project: { workspaceId: "ws1", prefix: "MOB" },
    ...overrides,
  };
}

function reset() {
  for (const m of [
    mockIssueFindUnique,
    mockAttachmentCreate,
    mockAttachmentFindUnique,
    mockAttachmentDelete,
    mockRequirePermissionOr,
    mockRequestAttachmentUpload,
    mockFinalizeAttachmentUpload,
    mockResolveAttachmentUrl,
    mockDeleteAttachmentObject,
  ]) {
    m.mockReset();
  }
  mockIssueFindUnique.mockResolvedValue(issueRow());
  mockRequirePermissionOr.mockResolvedValue(ACTOR);
}

describe("requestIssueAttachmentUpload()", () => {
  beforeEach(reset);

  it("checks the same permission as updateIssue", async () => {
    mockRequestAttachmentUpload.mockResolvedValue({
      ok: true,
      key: "attachments/i1/x.png",
      uploadUrl: "https://s3.example/put",
    });

    await requestIssueAttachmentUpload(ISSUE_ID, {
      fileName: "x.png",
      contentType: "image/png",
      contentLength: 100,
    });

    expect(mockRequirePermissionOr).toHaveBeenCalledWith([
      { permission: "issue.update.any", ctx: { projectId: "p1" } },
      {
        permission: "issue.update.own",
        ctx: { projectId: "p1" },
        ownerIds: ["u-reporter", null],
      },
    ]);
  });

  it("passes the storage layer's result through unchanged", async () => {
    mockRequestAttachmentUpload.mockResolvedValue({
      error: "File is too large (max. 100 MB).",
    });

    const result = await requestIssueAttachmentUpload(ISSUE_ID, {
      fileName: "video.mp4",
      contentType: "video/mp4",
      contentLength: 999,
    });

    expect(result).toEqual({ error: "File is too large (max. 100 MB)." });
    expect(mockRequestAttachmentUpload).toHaveBeenCalledWith({
      issueId: ISSUE_ID,
      fileName: "video.mp4",
      contentType: "video/mp4",
      contentLength: 999,
    });
  });

  it("rejects without permission before the storage layer runs", async () => {
    mockRequirePermissionOr.mockRejectedValue(new Error("denied"));
    await expect(
      requestIssueAttachmentUpload(ISSUE_ID, {
        fileName: "x.png",
        contentType: "image/png",
        contentLength: 100,
      }),
    ).rejects.toThrow("denied");
    expect(mockRequestAttachmentUpload).not.toHaveBeenCalled();
  });
});

describe("confirmIssueAttachmentUpload()", () => {
  beforeEach(reset);

  it("doesn't create a row when the storage layer errors", async () => {
    mockFinalizeAttachmentUpload.mockResolvedValue({
      error: "Upload not found — please try again.",
    });

    const result = await confirmIssueAttachmentUpload(
      ISSUE_ID,
      "attachments/i1/x.png",
      { fileName: "x.png", contentType: "image/png" },
    );

    expect(result).toEqual({
      error: "Upload not found — please try again.",
    });
    expect(mockAttachmentCreate).not.toHaveBeenCalled();
  });

  it("creates the row with the actual size and resolves the URL", async () => {
    mockFinalizeAttachmentUpload.mockResolvedValue({ ok: true, size: 4096 });
    mockAttachmentCreate.mockResolvedValue({
      id: "att-1",
      name: "x.png",
      key: "attachments/i1/x.png",
      mimeType: "image/png",
      size: 4096,
      created: new Date("2026-01-01T00:00:00Z"),
      authorId: ACTOR,
    });
    mockResolveAttachmentUrl.mockResolvedValue("https://s3.example/get");

    const result = await confirmIssueAttachmentUpload(
      ISSUE_ID,
      "attachments/i1/x.png",
      { fileName: "x.png", contentType: "image/png" },
    );

    expect(mockAttachmentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        issueId: ISSUE_ID,
        authorId: ACTOR,
        kind: "file",
        name: "x.png",
        key: "attachments/i1/x.png",
        mimeType: "image/png",
        size: 4096,
      }),
    });
    expect(result).toEqual({
      ok: true,
      attachment: {
        id: "att-1",
        kind: "file",
        name: "x.png",
        url: "https://s3.example/get",
        mimeType: "image/png",
        size: 4096,
        createdAt: new Date("2026-01-01T00:00:00Z").getTime(),
        authorId: ACTOR,
      },
    });
  });
});

describe("addIssueLinkAttachment()", () => {
  beforeEach(reset);

  it("rejects a URL without http(s)", async () => {
    const result = await addIssueLinkAttachment(ISSUE_ID, {
      url: "javascript:alert(1)",
    });
    expect(result).toEqual({ error: "Only http(s) links are allowed." });
    expect(mockAttachmentCreate).not.toHaveBeenCalled();
  });

  it("adopts the given name", async () => {
    mockAttachmentCreate.mockResolvedValue({
      id: "att-2",
      name: "Figma",
      url: "https://figma.com/file/x",
      mimeType: null,
      created: new Date("2026-01-01T00:00:00Z"),
      authorId: ACTOR,
    });

    const result = await addIssueLinkAttachment(ISSUE_ID, {
      url: "https://figma.com/file/x",
      name: "Figma",
    });

    expect(mockAttachmentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "link",
        name: "Figma",
        url: "https://figma.com/file/x",
        mimeType: null,
      }),
    });
    if (!("ok" in result)) throw new Error("expected ok result");
    expect(result.attachment.kind).toBe("link");
    expect(result.attachment.mimeType).toBeNull();
    expect(result.attachment.size).toBeNull();
  });

  it("passes a guessed image MIME type through", async () => {
    mockAttachmentCreate.mockResolvedValue({
      id: "att-img",
      name: "photo.png",
      url: "https://example.com/photo.png",
      mimeType: "image/png",
      created: new Date("2026-01-01T00:00:00Z"),
      authorId: ACTOR,
    });

    const result = await addIssueLinkAttachment(ISSUE_ID, {
      url: "https://example.com/photo.png",
      mimeType: "image/png",
    });

    expect(mockAttachmentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ mimeType: "image/png" }),
    });
    if (!("ok" in result)) throw new Error("expected ok result");
    expect(result.attachment.mimeType).toBe("image/png");
  });

  it("derives the name from the hostname when none is given", async () => {
    mockAttachmentCreate.mockResolvedValue({
      id: "att-3",
      name: "figma.com",
      url: "https://figma.com/file/x",
      created: new Date(),
      authorId: ACTOR,
    });

    await addIssueLinkAttachment(ISSUE_ID, {
      url: "https://figma.com/file/x",
    });

    expect(mockAttachmentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "figma.com" }),
    });
  });
});

describe("deleteIssueAttachment()", () => {
  beforeEach(reset);

  it("rejects when the row doesn't exist", async () => {
    mockAttachmentFindUnique.mockResolvedValue(null);
    const result = await deleteIssueAttachment(ISSUE_ID, "att-x");
    expect(result).toEqual({ error: "Not found." });
    expect(mockAttachmentDelete).not.toHaveBeenCalled();
  });

  it("rejects when the row belongs to another issue", async () => {
    mockAttachmentFindUnique.mockResolvedValue({
      id: "att-1",
      issueId: "i-other",
      kind: "file",
      key: "attachments/i-other/x.png",
    });
    const result = await deleteIssueAttachment(ISSUE_ID, "att-1");
    expect(result).toEqual({ error: "Not found." });
    expect(mockAttachmentDelete).not.toHaveBeenCalled();
  });

  it("deletes a file row along with its S3 object", async () => {
    mockAttachmentFindUnique.mockResolvedValue({
      id: "att-1",
      issueId: ISSUE_ID,
      kind: "file",
      key: "attachments/i1/x.png",
    });
    const result = await deleteIssueAttachment(ISSUE_ID, "att-1");
    expect(result).toEqual({ ok: true });
    expect(mockAttachmentDelete).toHaveBeenCalledWith({
      where: { id: "att-1" },
    });
    expect(mockDeleteAttachmentObject).toHaveBeenCalledWith(
      "attachments/i1/x.png",
    );
  });

  it("deletes a link row without an S3 call", async () => {
    mockAttachmentFindUnique.mockResolvedValue({
      id: "att-2",
      issueId: ISSUE_ID,
      kind: "link",
      key: null,
    });
    const result = await deleteIssueAttachment(ISSUE_ID, "att-2");
    expect(result).toEqual({ ok: true });
    expect(mockDeleteAttachmentObject).not.toHaveBeenCalled();
  });
});
