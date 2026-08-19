import { beforeEach, describe, expect, it, mock } from "bun:test";

// Die Grenze der Plattformverwaltung, als Test.
//
// Die Regel „Stammdaten ja, Inhalte nein" steht sonst nur als Kommentar in
// `features/admin/queries.ts` — ein Kommentar hält niemanden auf, der in einem
// halben Jahr schnell die Issue-Titel mitladen will, damit die Liste
// „hilfreicher" wird. Diese Datei liest deshalb nach, was die Abfragen
// tatsächlich beim Server bestellen.

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

/** Alle Schlüssel einer verschachtelten Auswahl, flach. */
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

    // Zählen ja: `_count.select.issues` sagt, wie viel drin liegt.
    expect(keys).toContain("_count.select.issues");

    // Lesen nein: eine Auswahl auf der Relation selbst gäbe es nicht als Zahl,
    // sondern als Zeilen — und damit als Titel, Beschreibungen, Kommentare.
    expect(keys).not.toContain("issues");
    expect(keys).not.toContain("comments");
    for (const key of keys) {
      expect(key.startsWith("issues.")).toBe(false);
      expect(key.startsWith("comments.")).toBe(false);
    }
  });

  it("holt private Projekte mit — sie sind der Grund für die Liste", async () => {
    await getAllProjects();
    // Kein `where` heißt: alle. Verwaiste private Projekte sind genau die, die
    // sonst niemandem auffallen.
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
    // Kein eigenes Passwort mehr — `hasPasskey` kommt aus
    // `_count.select.authenticators`, nicht aus einer zweiten Abfrage.
    await getAllUsers();

    const keys = keysOf(mockUserFindMany.mock.calls[0][0].select);
    expect(keys).toContain("_count.select.authenticators");
  });
});
