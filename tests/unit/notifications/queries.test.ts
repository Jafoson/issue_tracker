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
  it("liefert nichts ohne Sitzung", async () => {
    mockGetSession.mockResolvedValue(null);

    expect(await getNotifications(WS, "all")).toEqual([]);
    expect(mockNotificationFindMany).not.toHaveBeenCalled();
  });

  it("filtert nicht weiter zusätzlich bei 'all'", async () => {
    await getNotifications(WS, "all");

    const where = mockNotificationFindMany.mock.calls[0][0].where;
    expect(where).toEqual({ userId: ME, workspaceId: WS });
  });

  it("schränkt bei 'workspace' auf projektlose Zeilen ein", async () => {
    await getNotifications(WS, "workspace");

    const where = mockNotificationFindMany.mock.calls[0][0].where;
    expect(where.projectId).toBeNull();
  });

  it("schränkt bei 'project' auf projekt-gebundene Zeilen ein", async () => {
    await getNotifications(WS, "project");

    const where = mockNotificationFindMany.mock.calls[0][0].where;
    expect(where.projectId).toEqual({ not: null });
  });

  it("baut den Issue-Identifier aus dem Projekt-Prefix und dem Issue-Key", async () => {
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

  it("liest eine gesetzte readAt als gelesen", async () => {
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
  it("liefert 0 ohne Sitzung", async () => {
    mockGetSession.mockResolvedValue(null);

    expect(await getUnreadNotificationCount(WS)).toBe(0);
    expect(mockNotificationCount).not.toHaveBeenCalled();
  });

  it("zählt nur ungelesene der eigenen Sitzung im aktiven Workspace", async () => {
    mockNotificationCount.mockResolvedValue(3);

    expect(await getUnreadNotificationCount(WS)).toBe(3);
    expect(mockNotificationCount.mock.calls[0][0].where).toEqual({
      userId: ME,
      workspaceId: WS,
      readAt: null,
    });
  });
});
