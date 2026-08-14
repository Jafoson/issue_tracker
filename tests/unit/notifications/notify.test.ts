import { beforeEach, describe, expect, it, mock } from "bun:test";

// `notify()` ist der Schreibpunkt, den `features/issues/actions.ts`,
// `features/workspaces/actions.ts` und `features/projects/actions.ts`
// gemeinsam nutzen. Getestet wird hier nur er selbst — die Aufrufer mocken
// `@/lib/db`, nicht `@/lib/notify` (siehe CLAUDE.md).

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

// Der Mailversand selbst ist Sache von `lib/mail` (eigene Tests unter
// `tests/unit/mail`). Hier wird nur geprüft, *ob* und *für wen* `notify()`
// ihn anstößt — deshalb wird das Modul komplett ersetzt statt SMTP-Variablen
// in der Umgebung zu setzen.
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
  // Ohne SMTP-Konfiguration verschickt die App keine Mails — derselbe Default
  // wie in jeder Umgebung ohne `SMTP_HOST`. Die Mail-Tests unten schalten das
  // gezielt um.
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

describe("notify() — Mailversand", () => {
  it("verschickt keine Mail, solange kein SMTP konfiguriert ist", async () => {
    mockIsMailConfigured.mockReturnValue(false);

    await notify({ ...base, userId: "u-other", type: "assigned" });

    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("verschickt eine Mail, wenn SMTP konfiguriert ist und niemand widerspricht", async () => {
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

  it("respektiert einen abgeschalteten Mail-Kanal, unabhängig vom In-App-Kanal", async () => {
    mockIsMailConfigured.mockReturnValue(true);
    mockPreferencesFindMany.mockResolvedValue([
      { userId: "u-other", commentInApp: true, commentEmail: false },
    ]);

    await notify({ ...base, userId: "u-other", type: "comment" });

    // In-App bleibt an (Default bzw. hier explizit true) — nur die Mail fällt weg.
    expect(mockNotificationCreateMany).toHaveBeenCalledTimes(1);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("greift auf den Schema-Default zurück, wenn nichts eingestellt ist (Kommentare: aus)", async () => {
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

  it("lädt Workspace/Projekt/Issue nur einmal für mehrere Empfänger derselben Zeile", async () => {
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

  it("gibt einen Admin-Override an notificationEmail() weiter, keyed nach Anlass", async () => {
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

  it("verschickt keine Mail an eine Empfänger-Id ohne bekannte Adresse", async () => {
    mockIsMailConfigured.mockReturnValue(true);
    mockUserFindMany.mockResolvedValue([
      { id: "u-actor", firstName: "Ada", lastName: "Lovelace" },
    ]);

    await notify({ ...base, userId: "u-other", type: "assigned" });

    expect(mockSendMail).not.toHaveBeenCalled();
  });
});
