import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockNotificationUpdateMany = mock();

mock.module("@/lib/db", () => ({
  db: { notification: { updateMany: mockNotificationUpdateMany } },
}));

const mockGetSession = mock();
mock.module("@/lib/session", () => ({ getSession: mockGetSession }));
mock.module("next/cache", () => ({ revalidatePath: mock() }));

import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/actions";

const ME = "u-me";
const WS = "ws-1";

function reset() {
  for (const m of [mockNotificationUpdateMany, mockGetSession]) m.mockReset();
  mockGetSession.mockResolvedValue({ userId: ME });
  mockNotificationUpdateMany.mockResolvedValue({ count: 1 });
}

beforeEach(reset);

describe("markNotificationRead()", () => {
  it("rejects when no one is logged in", async () => {
    mockGetSession.mockResolvedValue(null);

    const result = await markNotificationRead("n-1");
    expect(result).toEqual({ error: "You must be logged in." });
    expect(mockNotificationUpdateMany).not.toHaveBeenCalled();
  });

  it("marks only its own, still-unread row", async () => {
    await markNotificationRead("n-1");

    expect(mockNotificationUpdateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "n-1", userId: ME, readAt: null },
    });
    expect(
      mockNotificationUpdateMany.mock.calls[0][0].data.readAt,
    ).toBeInstanceOf(Date);
  });
});

describe("markAllNotificationsRead()", () => {
  it("rejects when no one is logged in", async () => {
    mockGetSession.mockResolvedValue(null);

    const result = await markAllNotificationsRead(WS);
    expect(result).toEqual({ error: "You must be logged in." });
    expect(mockNotificationUpdateMany).not.toHaveBeenCalled();
  });

  it("marks all unread rows of the current session in the active workspace", async () => {
    await markAllNotificationsRead(WS);

    expect(mockNotificationUpdateMany.mock.calls[0][0].where).toEqual({
      userId: ME,
      workspaceId: WS,
      readAt: null,
    });
  });
});
