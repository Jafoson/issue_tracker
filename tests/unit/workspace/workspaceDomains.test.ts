import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockWorkspaceDomainFindUnique = mock();
const mockWorkspaceDomainCreate = mock();
const mockWorkspaceDomainDeleteMany = mock();

mock.module("@/lib/db", () => ({
  db: {
    workspaceDomain: {
      findUnique: mockWorkspaceDomainFindUnique,
      create: mockWorkspaceDomainCreate,
      deleteMany: mockWorkspaceDomainDeleteMany,
    },
  },
}));

const mockCan = mock();
const mockCurrentUserId = mock();

mock.module("@/lib/permissions", () => ({
  can: mockCan,
  currentUserId: mockCurrentUserId,
  accessFor: mock(),
  requirePermission: mock(),
  PermissionError: class PermissionError extends Error {},
  assignmentCeiling: () => Number.POSITIVE_INFINITY,
}));

mock.module("@/lib/session", () => ({ getSession: mock() }));
mock.module("next/cache", () => ({ revalidatePath: mock() }));

import {
  addWorkspaceDomain,
  removeWorkspaceDomain,
} from "@/features/workspaces/actions";

const WS = "acme";
const ACTOR = "u-actor";

function reset() {
  for (const m of [
    mockWorkspaceDomainFindUnique,
    mockWorkspaceDomainCreate,
    mockWorkspaceDomainDeleteMany,
    mockCan,
    mockCurrentUserId,
  ]) {
    m.mockReset();
  }

  mockCurrentUserId.mockResolvedValue(ACTOR);
  mockCan.mockResolvedValue(true);
  mockWorkspaceDomainFindUnique.mockResolvedValue(null);
  mockWorkspaceDomainCreate.mockResolvedValue({});
  mockWorkspaceDomainDeleteMany.mockResolvedValue({ count: 1 });
}

describe("addWorkspaceDomain()", () => {
  beforeEach(reset);

  it("rejects when nobody is logged in", async () => {
    mockCurrentUserId.mockResolvedValue(null);
    expect(await addWorkspaceDomain(WS, "acme.com")).toEqual({
      error: "You must be logged in.",
    });
  });

  it("requires workspace.update", async () => {
    mockCan.mockResolvedValue(false);
    expect(await addWorkspaceDomain(WS, "acme.com")).toEqual({
      error: "You are not allowed to change this workspace.",
    });
    expect(mockWorkspaceDomainCreate).not.toHaveBeenCalled();
  });

  it("normalizes case and a leading @", async () => {
    await addWorkspaceDomain(WS, "  @Acme.COM ");
    expect(mockWorkspaceDomainCreate).toHaveBeenCalledWith({
      data: { domain: "acme.com", workspaceId: WS },
    });
  });

  it("rejects an invalid format", async () => {
    expect(await addWorkspaceDomain(WS, "nicht so")).toEqual({
      error: "Please enter a valid domain, e.g. acme.com.",
    });
    expect(mockWorkspaceDomainCreate).not.toHaveBeenCalled();
  });

  it("rejects known freemail domains", async () => {
    expect(await addWorkspaceDomain(WS, "gmail.com")).toEqual({
      error: "This is a public email provider and cannot be claimed.",
    });
    expect(mockWorkspaceDomainCreate).not.toHaveBeenCalled();
  });

  it("reports when the own workspace already has the domain", async () => {
    mockWorkspaceDomainFindUnique.mockResolvedValue({ workspaceId: WS });
    expect(await addWorkspaceDomain(WS, "acme.com")).toEqual({
      error: "This domain is already added.",
    });
  });

  it("reports when another workspace already has the domain", async () => {
    mockWorkspaceDomainFindUnique.mockResolvedValue({ workspaceId: "andere" });
    expect(await addWorkspaceDomain(WS, "acme.com")).toEqual({
      error: "Another workspace already uses this domain.",
    });
    expect(mockWorkspaceDomainCreate).not.toHaveBeenCalled();
  });

  it("creates the domain", async () => {
    expect(await addWorkspaceDomain(WS, "acme.com")).toEqual({ ok: true });
  });
});

describe("removeWorkspaceDomain()", () => {
  beforeEach(reset);

  it("requires workspace.update", async () => {
    mockCan.mockResolvedValue(false);
    expect(await removeWorkspaceDomain(WS, "acme.com")).toEqual({
      error: "You are not allowed to change this workspace.",
    });
    expect(mockWorkspaceDomainDeleteMany).not.toHaveBeenCalled();
  });

  it("deletes the domain, scoped to the own workspace", async () => {
    expect(await removeWorkspaceDomain(WS, "acme.com")).toEqual({ ok: true });
    expect(mockWorkspaceDomainDeleteMany).toHaveBeenCalledWith({
      where: { domain: "acme.com", workspaceId: WS },
    });
  });
});
