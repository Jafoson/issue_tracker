import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const PROJECTS = [
  { id: "p-1", name: "Web", slug: "web", prefix: "WEB", color: "#111" },
  { id: "p-2", name: "App", slug: "app", prefix: "APP", color: "#222" },
  { id: "p-3", name: "Ops", slug: "ops", prefix: "OPS", color: "#333" },
];

const ME = {
  id: "u-1",
  firstName: "Ada",
  lastName: "L",
  email: "ada@example.com",
  color: "#111",
};

const mockGetMe = mock();

mock.module("@/features/workspaces/queries", () => ({
  getCurrentWorkspace: mock(async () => ({
    id: "acme",
    name: "Acme",
    color: "#111",
  })),
  getMe: mockGetMe,
  getWorkspaceProjects: mock(async () => PROJECTS),
  getWorkspaceMembers: mock(async () => [ME]),
  getWorkspaceLabels: mock(async () => []),
  getWorkspaceStatuses: mock(async () => [
    { id: "backlog", name: "Backlog", short: "B", color: "#111" },
  ]),
  getWorkspacePriorities: mock(async () => []),
  getWorkspaceIssueTypes: mock(async () => [
    { id: "feature", name: "Feature", color: "#111" },
  ]),
  getWorkspaceSearchIssues: mock(async () => []),
}));

const mockHasPermission = mock();
mock.module("@/lib/permissions", () => ({
  hasPermission: mockHasPermission,
}));

import { getIssueComposerData } from "@/features/issues/editor-data";

/** Erlaubt `issue.create` nur in den genannten Projekten. */
function allowIn(...projectIds: string[]) {
  mockHasPermission.mockImplementation(
    async (permission: string, ctx: { projectId?: string }) =>
      permission === "issue.create" &&
      !!ctx.projectId &&
      projectIds.includes(ctx.projectId),
  );
}

describe("getIssueComposerData() — wo darf angelegt werden", () => {
  beforeEach(() => {
    mockGetMe.mockReset();
    mockGetMe.mockResolvedValue(ME);
    mockHasPermission.mockReset();
  });

  it("nennt nur die Projekte mit issue.create", async () => {
    allowIn("p-1", "p-3");
    const data = await getIssueComposerData();
    expect(data?.creatableProjectIds).toEqual(["p-1", "p-3"]);
  });

  it("gibt eine leere Liste, wenn nirgends etwas entstehen darf", async () => {
    allowIn();
    const data = await getIssueComposerData();
    expect(data?.creatableProjectIds).toEqual([]);
  });

  it("fragt je sichtbarem Projekt im Projekt-Kontext", async () => {
    allowIn("p-1");
    await getIssueComposerData();
    expect(mockHasPermission.mock.calls).toEqual([
      ["issue.create", { projectId: "p-1" }],
      ["issue.create", { projectId: "p-2" }],
      ["issue.create", { projectId: "p-3" }],
    ]);
  });

  // `projects` ist auch die Nachschlagetabelle für bestehende Issues (Prefix,
  // Farbe). Wer sie kürzte, um Knöpfe zu verstecken, hätte Karten ohne Projekt.
  it("kürzt die Projektliste selbst nicht", async () => {
    allowIn("p-1");
    const data = await getIssueComposerData();
    expect(data?.projects).toHaveLength(3);
  });

  it("gibt null ohne Session — daran hängt die ganze Oberfläche", async () => {
    mockGetMe.mockResolvedValue(null);
    allowIn("p-1");
    expect(await getIssueComposerData()).toBeNull();
  });
});
