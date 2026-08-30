import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockNotificationFindMany = mock();
const mockNotificationCount = mock();

mock.module("@/lib/db", () => ({
  db: {
    notification: {
      findMany: mockNotificationFindMany,
      count: mockNotificationCount,
    },
  },
}));

const mockGetSession = mock();
mock.module("@/lib/session", () => ({ getSession: mockGetSession }));

import {
  getNotifications,
  getUnreadNotificationCount,
} from "@/features/notifications/queries";

const ME = "u-me";
const WS = "ws-1";

function reset() {
  for (const m of [
    mockNotificationFindMany,
    mockNotificationCount,
    mockGetSession,
  ]) {
    m.mockReset();
  }
  mockGetSession.mockResolvedValue({ userId: ME });
  mockNotificationFindMany.mockResolvedValue([]);
  mockNotificationCount.mockResolvedValue(0);
}

beforeEach(reset);

describe("getNotifications()", () => {
  it("returns nothing without a session", async () => {
    mockGetSession.mockResolvedValue(null);

    expect(await getNotifications(WS, "all")).toEqual([]);
    expect(mockNotificationFindMany).not.toHaveBeenCalled();
  });

  it("adds no further filtering for 'all'", async () => {
    await getNotifications(WS, "all");

    const where = mockNotificationFindMany.mock.calls[0][0].where;
    expect(where).toEqual({ userId: ME, workspaceId: WS });
  });

  it("restricts to project-less rows for 'workspace'", async () => {
    await getNotifications(WS, "workspace");

    const where = mockNotificationFindMany.mock.calls[0][0].where;
    expect(where.projectId).toBeNull();
  });

  it("restricts to project-bound rows for 'project'", async () => {
    await getNotifications(WS, "project");

    const where = mockNotificationFindMany.mock.calls[0][0].where;
    expect(where.projectId).toEqual({ not: null });
  });

  it("builds the issue identifier from the project prefix and the issue key", async () => {
    mockNotificationFindMany.mockResolvedValue([
      {
        id: "n-1",
        type: "assigned",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        readAt: null,
        actorLabel: "Ada Lovelace",
        text: "",
        project: { slug: "core", name: "Core", prefix: "COR" },
        issue: { key: 42, title: "Login kaputt", status: "todo" },
      },
    ]);

    const [row] = await getNotifications(WS, "all");
    expect(row.issue).toEqual({
      identifier: "COR-42",
      title: "Login kaputt",
      status: "todo",
    });
    expect(row.read).toBe(false);
  });

  it("reads a set readAt as read", async () => {
    mockNotificationFindMany.mockResolvedValue([
      {
        id: "n-1",
        type: "role",
        createdAt: new Date(),
        readAt: new Date(),
        actorLabel: "Ada",
        text: "Manager",
        project: null,
        issue: null,
      },
    ]);

    const [row] = await getNotifications(WS, "all");
    expect(row.read).toBe(true);
    expect(row.project).toBeNull();
    expect(row.issue).toBeNull();
  });
});

describe("getUnreadNotificationCount()", () => {
  it("returns 0 without a session", async () => {
    mockGetSession.mockResolvedValue(null);

    expect(await getUnreadNotificationCount(WS)).toBe(0);
    expect(mockNotificationCount).not.toHaveBeenCalled();
  });

  it("counts only unread rows of the current session in the active workspace", async () => {
    mockNotificationCount.mockResolvedValue(3);

    expect(await getUnreadNotificationCount(WS)).toBe(3);
    expect(mockNotificationCount.mock.calls[0][0].where).toEqual({
      userId: ME,
      workspaceId: WS,
      readAt: null,
    });
  });
});
