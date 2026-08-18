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

  it("lehnt ab, wenn niemand eingeloggt ist", async () => {
    mockCurrentUserId.mockResolvedValue(null);
    expect(await addWorkspaceDomain(WS, "acme.com")).toEqual({
      error: "You must be logged in.",
    });
  });

  it("verlangt workspace.update", async () => {
    mockCan.mockResolvedValue(false);
    expect(await addWorkspaceDomain(WS, "acme.com")).toEqual({
      error: "You are not allowed to change this workspace.",
    });
    expect(mockWorkspaceDomainCreate).not.toHaveBeenCalled();
  });

  it("normalisiert Groß-/Kleinschreibung und ein führendes @", async () => {
    await addWorkspaceDomain(WS, "  @Acme.COM ");
    expect(mockWorkspaceDomainCreate).toHaveBeenCalledWith({
      data: { domain: "acme.com", workspaceId: WS },
    });
  });

  it("lehnt ein ungültiges Format ab", async () => {
    expect(await addWorkspaceDomain(WS, "nicht so")).toEqual({
      error: "Please enter a valid domain, e.g. acme.com.",
    });
    expect(mockWorkspaceDomainCreate).not.toHaveBeenCalled();
  });

  it("lehnt bekannte Freemail-Domains ab", async () => {
    expect(await addWorkspaceDomain(WS, "gmail.com")).toEqual({
      error: "This is a public email provider and cannot be claimed.",
    });
    expect(mockWorkspaceDomainCreate).not.toHaveBeenCalled();
  });

  it("meldet, wenn der eigene Workspace die Domain schon hat", async () => {
    mockWorkspaceDomainFindUnique.mockResolvedValue({ workspaceId: WS });
    expect(await addWorkspaceDomain(WS, "acme.com")).toEqual({
      error: "This domain is already added.",
    });
  });

  it("meldet, wenn ein anderer Workspace die Domain schon hat", async () => {
    mockWorkspaceDomainFindUnique.mockResolvedValue({ workspaceId: "andere" });
    expect(await addWorkspaceDomain(WS, "acme.com")).toEqual({
      error: "Another workspace already uses this domain.",
    });
    expect(mockWorkspaceDomainCreate).not.toHaveBeenCalled();
  });

  it("legt die Domain an", async () => {
    expect(await addWorkspaceDomain(WS, "acme.com")).toEqual({ ok: true });
  });
});

describe("removeWorkspaceDomain()", () => {
  beforeEach(reset);

  it("verlangt workspace.update", async () => {
    mockCan.mockResolvedValue(false);
    expect(await removeWorkspaceDomain(WS, "acme.com")).toEqual({
      error: "You are not allowed to change this workspace.",
    });
    expect(mockWorkspaceDomainDeleteMany).not.toHaveBeenCalled();
  });

  it("löscht die Domain, auf den eigenen Workspace begrenzt", async () => {
    expect(await removeWorkspaceDomain(WS, "acme.com")).toEqual({ ok: true });
    expect(mockWorkspaceDomainDeleteMany).toHaveBeenCalledWith({
      where: { domain: "acme.com", workspaceId: WS },
    });
  });
});
