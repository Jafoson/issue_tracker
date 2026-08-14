import { beforeEach, describe, expect, it, mock } from "bun:test";

// `notify()` ist der Schreibpunkt, den `features/issues/actions.ts`,
// `features/workspaces/actions.ts` und `features/projects/actions.ts`
// gemeinsam nutzen. Getestet wird hier nur er selbst — die Aufrufer mocken
// `@/lib/db`, nicht `@/lib/notify` (siehe CLAUDE.md).

const mockUserFindMany = mock();
const mockPreferencesFindMany = mock();
const mockNotificationCreateMany = mock();

mock.module("@/lib/db", () => ({
  db: {
    user: { findMany: mockUserFindMany },
    userPreferences: { findMany: mockPreferencesFindMany },
    notification: { createMany: mockNotificationCreateMany },
  },
}));

import { notify } from "@/lib/notify";

function reset() {
  for (const m of [
    mockUserFindMany,
    mockPreferencesFindMany,
    mockNotificationCreateMany,
  ]) {
    m.mockReset();
  }
  mockUserFindMany.mockResolvedValue([
    { id: "u-actor", firstName: "Ada", lastName: "Lovelace" },
  ]);
  mockPreferencesFindMany.mockResolvedValue([]);
  mockNotificationCreateMany.mockResolvedValue({ count: 1 });
}

beforeEach(reset);

const base = {
  actorId: "u-actor",
  workspaceId: "ws-1",
  projectId: "p-1",
  issueId: "i-1",
};

describe("notify()", () => {
  it("benachrichtigt niemanden über die eigene Tat", async () => {
    await notify({ ...base, userId: "u-actor", type: "comment" });

    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
  });

  it("schreibt eine Zeile mit eingefrorenem Actor-Namen", async () => {
    await notify({ ...base, userId: "u-other", type: "comment" });

    const rows = mockNotificationCreateMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: "u-other",
      type: "comment",
      actorId: "u-actor",
      actorLabel: "Ada Lovelace",
      workspaceId: "ws-1",
      projectId: "p-1",
      issueId: "i-1",
    });
  });

  it("gilt als eingeschaltet, solange niemand etwas eingestellt hat", async () => {
    // Keine `UserPreferences`-Zeile — der Schema-Default für jede `*InApp`-
    // Spalte ist `true`.
    mockPreferencesFindMany.mockResolvedValue([]);

    await notify({ ...base, userId: "u-other", type: "role" });

    expect(mockNotificationCreateMany).toHaveBeenCalledTimes(1);
  });

  it("respektiert einen abgeschalteten In-App-Kanal", async () => {
    mockPreferencesFindMany.mockResolvedValue([
      { userId: "u-other", statusInApp: false },
    ]);

    await notify({ ...base, userId: "u-other", type: "status" });

    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
  });

  it("lädt den Actor-Namen nur einmal für mehrere Empfänger", async () => {
    await notify([
      { ...base, userId: "u-1", type: "mentioned" },
      { ...base, userId: "u-2", type: "mentioned" },
    ]);

    expect(mockUserFindMany).toHaveBeenCalledTimes(1);
    expect(mockNotificationCreateMany.mock.calls[0][0].data).toHaveLength(2);
  });

  it("lässt die Aktion nicht scheitern, wenn das Schreiben klemmt", async () => {
    const error = console.error;
    console.error = () => {};
    mockNotificationCreateMany.mockRejectedValueOnce(new Error("DB weg"));

    expect(
      await notify({ ...base, userId: "u-other", type: "invite" }),
    ).toBeUndefined();

    console.error = error;
  });
});
