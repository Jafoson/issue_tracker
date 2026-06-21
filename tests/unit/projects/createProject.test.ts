import { describe, it, expect, mock, beforeEach } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockProjectFindUnique = mock();
const mockProjectCreate     = mock();

mock.module("@/lib/db", () => ({
  db: {
    project:         { findUnique: mockProjectFindUnique, create: mockProjectCreate },
    workspaceMember: { findUnique: mock() },
  },
}));

mock.module("@/lib/session", () => ({
  getSession: mock(),
}));

mock.module("next/cache", () => ({
  revalidatePath: mock(),
}));

import { createProject } from "@/features/projects/actions";
import { db }            from "@/lib/db";
import { getSession }    from "@/lib/session";

const mockGetSession        = getSession        as ReturnType<typeof mock>;
const mockFindUnique        = db.project.findUnique as ReturnType<typeof mock>;
const mockCreate            = db.project.create    as ReturnType<typeof mock>;
const mockMemberFindUnique  = db.workspaceMember.findUnique as ReturnType<typeof mock>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const WS = "my-workspace";
const MEMBER = { pending: false };

function reset() {
  mockGetSession.mockReset();
  mockFindUnique.mockReset();
  mockCreate.mockReset();
  mockMemberFindUnique.mockReset();

  mockGetSession.mockResolvedValue({ userId: "u1" });
  mockMemberFindUnique.mockResolvedValue(MEMBER);
  mockFindUnique.mockResolvedValue(null); // no conflicts by default
  mockCreate.mockResolvedValue({});
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createProject() — Slug-Generierung", () => {
  beforeEach(reset);

  it("leitet den Slug automatisch aus dem Namen ab", async () => {
    await createProject({ workspaceId: WS, name: "My Project", color: "#fff" });

    const created = mockCreate.mock.calls[0]?.[0]?.data;
    expect(created?.slug).toBe("my-project");
  });

  it("Sonderzeichen werden zu Bindestrichen", async () => {
    await createProject({ workspaceId: WS, name: "Foo & Bar!", color: "#fff" });

    const created = mockCreate.mock.calls[0]?.[0]?.data;
    expect(created?.slug).toBe("foo-bar");
  });

  it("führende und abschließende Bindestriche werden entfernt", async () => {
    await createProject({ workspaceId: WS, name: "---Test---", color: "#fff" });

    const created = mockCreate.mock.calls[0]?.[0]?.data;
    expect(created?.slug).toBe("test");
  });

  it("hängt -1 an wenn der Slug bereits vergeben ist", async () => {
    // First call (slug "fuchsly") → taken; second call ("fuchsly-1") → free.
    mockFindUnique
      .mockResolvedValueOnce({ id: "p-existing" }) // prefix check (free)
      .mockResolvedValueOnce(null)                  // prefix uniqueness done
      .mockResolvedValueOnce({ id: "p-existing" }) // slug "fuchsly" taken
      .mockResolvedValueOnce(null);                 // slug "fuchsly-1" free

    // Reset to simpler mock: only slug uniqueness matters here.
    mockFindUnique.mockReset();
    mockFindUnique
      .mockResolvedValueOnce(null)                 // prefix "FUCH" free
      .mockResolvedValueOnce({ id: "p-existing" }) // slug "fuchsly" taken
      .mockResolvedValueOnce(null);                // slug "fuchsly-1" free

    await createProject({ workspaceId: WS, name: "Fuchsly", color: "#fff" });

    const created = mockCreate.mock.calls[0]?.[0]?.data;
    expect(created?.slug).toBe("fuchsly-1");
  });

  it("zählt weiter hoch wenn auch fuchsly-1 vergeben ist", async () => {
    mockFindUnique
      .mockResolvedValueOnce(null)                  // prefix free
      .mockResolvedValueOnce({ id: "p1" })          // slug "fuchsly" taken
      .mockResolvedValueOnce({ id: "p2" })          // slug "fuchsly-1" taken
      .mockResolvedValueOnce(null);                 // slug "fuchsly-2" free

    await createProject({ workspaceId: WS, name: "Fuchsly", color: "#fff" });

    const created = mockCreate.mock.calls[0]?.[0]?.data;
    expect(created?.slug).toBe("fuchsly-2");
  });

  it("zwei Projekte mit gleichem Namen erhalten unterschiedliche Slugs", async () => {
    // First project: all free
    await createProject({ workspaceId: WS, name: "Orbit", color: "#fff" });
    const first = mockCreate.mock.calls[0]?.[0]?.data;
    expect(first?.slug).toBe("orbit");

    // Second project: slug "orbit" now taken
    mockCreate.mockClear();
    mockFindUnique.mockReset();
    mockFindUnique
      .mockResolvedValueOnce(null)           // prefix free
      .mockResolvedValueOnce({ id: "p-1" }) // slug "orbit" taken
      .mockResolvedValueOnce(null);          // slug "orbit-1" free

    await createProject({ workspaceId: WS, name: "Orbit", color: "#fff" });
    const second = mockCreate.mock.calls[0]?.[0]?.data;
    expect(second?.slug).toBe("orbit-1");

    expect(first?.slug).not.toBe(second?.slug);
  });
});

describe("createProject() — Fehlerbehandlung", () => {
  beforeEach(reset);

  it("gibt Fehler zurück wenn der User nicht eingeloggt ist", async () => {
    mockGetSession.mockResolvedValue(null);
    const result = await createProject({ workspaceId: WS, name: "X", color: "#fff" });
    expect(result).toEqual({ error: "You must be logged in." });
  });

  it("gibt Fehler zurück wenn der Name leer ist", async () => {
    const result = await createProject({ workspaceId: WS, name: "   ", color: "#fff" });
    expect(result).toEqual({ error: "Name is required." });
  });

  it("gibt Fehler zurück wenn der User kein Mitglied ist", async () => {
    mockMemberFindUnique.mockResolvedValue(null);
    const result = await createProject({ workspaceId: WS, name: "X", color: "#fff" });
    expect(result).toEqual({ error: "You are not a member of this workspace." });
  });

  it("gibt Fehler zurück wenn das Mitglied noch ausstehend ist", async () => {
    mockMemberFindUnique.mockResolvedValue({ pending: true });
    const result = await createProject({ workspaceId: WS, name: "X", color: "#fff" });
    expect(result).toEqual({ error: "You are not a member of this workspace." });
  });
});

describe("createProject() — Prefix-Generierung", () => {
  beforeEach(reset);

  it("leitet den Prefix aus den ersten 4 Buchstaben ab", async () => {
    await createProject({ workspaceId: WS, name: "Platform", color: "#fff" });
    const created = mockCreate.mock.calls[0]?.[0]?.data;
    expect(created?.prefix).toBe("PLAT");
  });

  it("nutzt einen explizit übergebenen Prefix", async () => {
    await createProject({ workspaceId: WS, name: "Platform", prefix: "PLT", color: "#fff" });
    const created = mockCreate.mock.calls[0]?.[0]?.data;
    expect(created?.prefix).toBe("PLT");
  });

  it("slug und prefix werden unabhängig voneinander dedupliziert", async () => {
    mockFindUnique.mockReset();
    // prefix "PLAN" free, slug "planning" free
    mockFindUnique.mockResolvedValue(null);

    await createProject({ workspaceId: WS, name: "Planning", color: "#fff" });

    const created = mockCreate.mock.calls[0]?.[0]?.data;
    expect(created?.prefix).toBe("PLAN");
    expect(created?.slug).toBe("planning");
  });
});
