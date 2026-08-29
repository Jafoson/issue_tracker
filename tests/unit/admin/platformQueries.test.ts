import { beforeEach, describe, expect, it, mock } from "bun:test";

// The boundary of platform administration, as a test.
//
// The rule "metadata yes, content no" otherwise exists only as a comment in
// `features/admin/queries.ts` — a comment won't stop someone who, six months
// from now, quickly wants to load issue titles along to make the list "more
// helpful." This file therefore checks what the queries actually request
// from the server.

const mockUserFindMany = mock();
const mockProjectFindMany = mock();

mock.module("@/lib/db", () => ({
  db: {
    user: { findMany: mockUserFindMany },
    project: { findMany: mockProjectFindMany },
  },
}));

const mockRequirePermission = mock(async () => "admin1");
mock.module("@/lib/permissions", () => ({
  requirePermission: mockRequirePermission,
  PLATFORM: { scope: "platform" },
}));

mock.module("react", () => ({ cache: <T>(fn: T) => fn }));

import { getAllProjects, getAllUsers } from "@/features/admin/queries";

/** All keys of a nested selection, flattened. */
function keysOf(select: unknown, path = ""): string[] {
  if (!select || typeof select !== "object") return [];
  return Object.entries(select as Record<string, unknown>).flatMap(
    ([key, value]) => {
      const here = path ? `${path}.${key}` : key;
      return [here, ...keysOf(value, here)];
    },
  );
}

beforeEach(() => {
  mock.clearAllMocks();
  mockRequirePermission.mockResolvedValue("admin1");
  mockUserFindMany.mockResolvedValue([]);
  mockProjectFindMany.mockResolvedValue([]);
});

describe("Projekt-Stammdaten", () => {
  it("verlangt project.metadata.view", async () => {
    await getAllProjects();
    expect(mockRequirePermission).toHaveBeenCalledWith(
      "project.metadata.view",
      { scope: "platform" },
    );
  });

  it("lädt keine Inhalte — Aufgaben und Kommentare nur als Zahl", async () => {
    await getAllProjects();

    const keys = keysOf(mockProjectFindMany.mock.calls[0][0].select);

    // Counting yes: `_count.select.issues` says how many are inside.
    expect(keys).toContain("_count.select.issues");

    // Reading no: a selection on the relation itself wouldn't come back as a
    // number, but as rows — and thus as titles, descriptions, comments.
    expect(keys).not.toContain("issues");
    expect(keys).not.toContain("comments");
    for (const key of keys) {
      expect(key.startsWith("issues.")).toBe(false);
      expect(key.startsWith("comments.")).toBe(false);
    }
  });

  it("holt private Projekte mit — sie sind der Grund für die Liste", async () => {
    await getAllProjects();
    // No `where` means: all. Orphaned private projects are exactly the ones
    // that nobody else would otherwise notice.
    expect(mockProjectFindMany.mock.calls[0][0].where).toBeUndefined();
  });
});

describe("Benutzerverwaltung", () => {
  it("verlangt user.manage", async () => {
    await getAllUsers();
    expect(mockRequirePermission).toHaveBeenCalledWith("user.manage", {
      scope: "platform",
    });
  });

  it("beantwortet die Frage nach dem Passkey über eine Zählung, nie über die Zeile selbst", async () => {
    // No password of its own anymore — `hasPasskey` comes from
    // `_count.select.authenticators`, not from a second query.
    await getAllUsers();

    const keys = keysOf(mockUserFindMany.mock.calls[0][0].select);
    expect(keys).toContain("_count.select.authenticators");
  });
});
