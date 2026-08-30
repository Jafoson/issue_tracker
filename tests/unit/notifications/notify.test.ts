import { beforeEach, describe, expect, it, mock } from "bun:test";

// `notify()` is the single write point shared by `features/issues/actions.ts`,
// `features/workspaces/actions.ts`, and `features/projects/actions.ts`. Only
// it itself is tested here — the callers mock `@/lib/db`, not `@/lib/notify`
// (see CLAUDE.md).

const mockUserFindMany = mock();
const mockPreferencesFindMany = mock();
const mockNotificationCreateMany = mock();
const mockWorkspaceFindUnique = mock();
const mockProjectFindUnique = mock();
const mockIssueFindUnique = mock();
const mockMailTemplateFindUnique = mock();

mock.module("@/lib/db", () => ({
  db: {
    user: { findMany: mockUserFindMany },
    userPreferences: { findMany: mockPreferencesFindMany },
    notification: { createMany: mockNotificationCreateMany },
    workspace: { findUnique: mockWorkspaceFindUnique },
    project: { findUnique: mockProjectFindUnique },
    issue: { findUnique: mockIssueFindUnique },
    mailTemplate: { findUnique: mockMailTemplateFindUnique },
  },
}));

// Sending mail itself is `lib/mail`'s job (own tests under
// `tests/unit/mail`). Here, only *whether* and *for whom* `notify()`
// triggers it is checked — that's why the module is replaced entirely
// instead of setting SMTP variables in the environment.
const mockIsMailConfigured = mock();
const mockSendMail = mock();
const mockNotificationEmail = mock();

mock.module("@/lib/mail", () => ({
  isMailConfigured: mockIsMailConfigured,
  sendMail: mockSendMail,
  notificationEmail: mockNotificationEmail,
}));

import { notify } from "@/lib/notify";

function reset() {
  for (const m of [
    mockUserFindMany,
    mockPreferencesFindMany,
    mockNotificationCreateMany,
    mockWorkspaceFindUnique,
    mockProjectFindUnique,
    mockIssueFindUnique,
    mockMailTemplateFindUnique,
    mockIsMailConfigured,
    mockSendMail,
    mockNotificationEmail,
  ]) {
    m.mockReset();
  }
  mockUserFindMany.mockResolvedValue([
    { id: "u-actor", firstName: "Ada", lastName: "Lovelace" },
  ]);
  mockPreferencesFindMany.mockResolvedValue([]);
  mockNotificationCreateMany.mockResolvedValue({ count: 1 });
  // Without SMTP configuration, the app sends no mail — the same default as
  // in any environment without `SMTP_HOST`. The mail tests below switch this
  // on deliberately where needed.
  mockIsMailConfigured.mockReturnValue(false);
  mockWorkspaceFindUnique.mockResolvedValue({ name: "Acme" });
  mockProjectFindUnique.mockResolvedValue({
    name: "Mobile",
    slug: "mobile",
    prefix: "MOB",
  });
  mockIssueFindUnique.mockResolvedValue({ key: 1, title: "Login-Fehler" });
  mockMailTemplateFindUnique.mockResolvedValue(null);
  mockNotificationEmail.mockReturnValue({
    subject: "Betreff",
    html: "<p>Text</p>",
    text: "Text",
  });
}

beforeEach(reset);

const base = {
  actorId: "u-actor",
  workspaceId: "ws-1",
  projectId: "p-1",
  issueId: "i-1",
};

describe("notify()", () => {
  it("notifies no one about their own action", async () => {
    await notify({ ...base, userId: "u-actor", type: "comment" });

    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
  });

  it("writes a row with a frozen actor name", async () => {
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

  it("counts as on as long as no one has configured anything", async () => {
    // No `UserPreferences` row — the schema default for every `*InApp`
    // column is `true`.
    mockPreferencesFindMany.mockResolvedValue([]);

    await notify({ ...base, userId: "u-other", type: "role" });

    expect(mockNotificationCreateMany).toHaveBeenCalledTimes(1);
  });

  it("respects a disabled in-app channel", async () => {
    mockPreferencesFindMany.mockResolvedValue([
      { userId: "u-other", statusInApp: false },
    ]);

    await notify({ ...base, userId: "u-other", type: "status" });

    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
  });

  it("loads the actor name only once for multiple recipients", async () => {
    await notify([
      { ...base, userId: "u-1", type: "mentioned" },
      { ...base, userId: "u-2", type: "mentioned" },
    ]);

    expect(mockUserFindMany).toHaveBeenCalledTimes(1);
    expect(mockNotificationCreateMany.mock.calls[0][0].data).toHaveLength(2);
  });

  it("does not let the action fail when the write jams", async () => {
    const error = console.error;
    console.error = () => {};
    mockNotificationCreateMany.mockRejectedValueOnce(new Error("DB weg"));

    expect(
      await notify({ ...base, userId: "u-other", type: "invite" }),
    ).toBeUndefined();

    console.error = error;
  });
});

describe("notify() — mail sending", () => {
  it("sends no mail as long as SMTP is not configured", async () => {
    mockIsMailConfigured.mockReturnValue(false);

    await notify({ ...base, userId: "u-other", type: "assigned" });

    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("sends a mail when SMTP is configured and no one objects", async () => {
    mockIsMailConfigured.mockReturnValue(true);
    mockUserFindMany.mockResolvedValue([
      { id: "u-actor", firstName: "Ada", lastName: "Lovelace" },
      { id: "u-other", email: "other@example.com" },
    ]);

    await notify({ ...base, userId: "u-other", type: "assigned" });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail.mock.calls[0][0]).toMatchObject({
      to: "other@example.com",
      subject: "Betreff",
    });
  });

  it("respects a disabled mail channel, independent of the in-app channel", async () => {
    mockIsMailConfigured.mockReturnValue(true);
    mockPreferencesFindMany.mockResolvedValue([
      { userId: "u-other", commentInApp: true, commentEmail: false },
    ]);

    await notify({ ...base, userId: "u-other", type: "comment" });

    // In-app stays on (default, or here explicitly true) — only the email is skipped.
    expect(mockNotificationCreateMany).toHaveBeenCalledTimes(1);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("falls back to the schema default when nothing is configured (comments: off)", async () => {
    mockIsMailConfigured.mockReturnValue(true);
    mockPreferencesFindMany.mockResolvedValue([]);
    mockUserFindMany.mockResolvedValue([
      { id: "u-actor", firstName: "Ada", lastName: "Lovelace" },
      { id: "u-other", email: "other@example.com" },
    ]);

    await notify({ ...base, userId: "u-other", type: "comment" });
    expect(mockSendMail).not.toHaveBeenCalled();

    await notify({ ...base, userId: "u-other", type: "assigned" });
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it("loads workspace/project/issue only once for multiple recipients of the same row", async () => {
    mockIsMailConfigured.mockReturnValue(true);
    mockUserFindMany.mockResolvedValue([
      { id: "u-actor", firstName: "Ada", lastName: "Lovelace" },
      { id: "u-1", email: "u1@example.com" },
      { id: "u-2", email: "u2@example.com" },
    ]);

    await notify([
      { ...base, userId: "u-1", type: "mentioned" },
      { ...base, userId: "u-2", type: "mentioned" },
    ]);

    expect(mockWorkspaceFindUnique).toHaveBeenCalledTimes(1);
    expect(mockIssueFindUnique).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledTimes(2);
  });

  it("passes an admin override through to notificationEmail(), keyed by occasion", async () => {
    mockIsMailConfigured.mockReturnValue(true);
    mockUserFindMany.mockResolvedValue([
      { id: "u-actor", firstName: "Ada", lastName: "Lovelace" },
      { id: "u-other", email: "other@example.com" },
    ]);
    const override = { subject: "S", heading: "H", bodyText: "B" };
    mockMailTemplateFindUnique.mockResolvedValue({
      key: "notification.assigned",
      subject: "S",
      heading: "H",
      bodyText: "B",
      updatedAt: new Date(),
    });

    await notify({ ...base, userId: "u-other", type: "assigned" });

    expect(mockMailTemplateFindUnique).toHaveBeenCalledWith({
      where: { key: "notification.assigned" },
    });
    expect(mockNotificationEmail.mock.calls[0][1]).toEqual(override);
  });

  it("sends no mail to a recipient id without a known address", async () => {
    mockIsMailConfigured.mockReturnValue(true);
    mockUserFindMany.mockResolvedValue([
      { id: "u-actor", firstName: "Ada", lastName: "Lovelace" },
    ]);

    await notify({ ...base, userId: "u-other", type: "assigned" });

    expect(mockSendMail).not.toHaveBeenCalled();
  });
});
