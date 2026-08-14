import { beforeEach, describe, expect, it, mock } from "bun:test";

// Verwaltung der Mail-Vorlagen: `getMailTemplates` (Katalog + DB-Override
// zusammenführen) und `saveMailTemplate`/`resetMailTemplate` (Admin-Aktionen).

const mockMailTemplateFindMany = mock();
const mockMailTemplateUpsert = mock();
const mockMailTemplateDeleteMany = mock();
const mockAuditCreate = mock();
const mockUserFindUnique = mock();

mock.module("@/lib/db", () => ({
  db: {
    mailTemplate: {
      findMany: mockMailTemplateFindMany,
      upsert: mockMailTemplateUpsert,
      deleteMany: mockMailTemplateDeleteMany,
    },
    auditLog: { create: mockAuditCreate },
    user: { findUnique: mockUserFindUnique },
  },
}));
mock.module("next/cache", () => ({ revalidatePath: mock() }));

const mockRequirePermission = mock(async () => "admin1");
mock.module("@/lib/permissions", () => ({
  requirePermission: mockRequirePermission,
  PLATFORM: { scope: "platform" },
}));

const mockIsMailConfigured = mock();
const mockSendMail = mock();
mock.module("@/lib/mail", () => ({
  isMailConfigured: mockIsMailConfigured,
  sendMail: mockSendMail,
}));

mock.module("react", () => ({ cache: <T>(fn: T) => fn }));

import {
  resetMailTemplate,
  saveMailTemplate,
  sendTestMailTemplate,
} from "@/features/mail-templates/actions";
import { MAIL_TEMPLATE_KEYS } from "@/features/mail-templates/catalog";
import {
  getCurrentAdminEmail,
  getMailTemplates,
} from "@/features/mail-templates/queries";

function reset() {
  for (const m of [
    mockMailTemplateFindMany,
    mockMailTemplateUpsert,
    mockMailTemplateDeleteMany,
    mockAuditCreate,
    mockUserFindUnique,
    mockRequirePermission,
    mockIsMailConfigured,
    mockSendMail,
  ]) {
    m.mockReset();
  }
  mockRequirePermission.mockResolvedValue("admin1");
  mockMailTemplateFindMany.mockResolvedValue([]);
  mockMailTemplateUpsert.mockResolvedValue({});
  mockMailTemplateDeleteMany.mockResolvedValue({ count: 1 });
  mockAuditCreate.mockResolvedValue({});
  mockUserFindUnique.mockResolvedValue({
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
  });
  mockIsMailConfigured.mockReturnValue(true);
  mockSendMail.mockResolvedValue(undefined);
}

beforeEach(reset);

describe("getMailTemplates()", () => {
  it("prüft die Berechtigung", async () => {
    await getMailTemplates();
    expect(mockRequirePermission).toHaveBeenCalledWith("mail.template.manage", {
      scope: "platform",
    });
  });

  it("liefert jeden Katalog-Schlüssel genau einmal, ohne Override", async () => {
    mockMailTemplateFindMany.mockResolvedValue([]);

    const rows = await getMailTemplates();

    expect(rows).toHaveLength(MAIL_TEMPLATE_KEYS.length);
    expect(new Set(rows.map((r) => r.key)).size).toBe(
      MAIL_TEMPLATE_KEYS.length,
    );
    for (const row of rows) {
      expect(row.override).toBeNull();
      expect(row.updatedAt).toBeNull();
    }
  });

  it("merged eine vorhandene DB-Zeile in den passenden Katalog-Eintrag", async () => {
    const updatedAt = new Date("2026-08-14T10:00:00Z");
    mockMailTemplateFindMany.mockResolvedValue([
      {
        key: "invitation",
        subject: "S",
        heading: "H",
        bodyText: "B",
        updatedAt,
      },
    ]);

    const rows = await getMailTemplates();
    const invitation = rows.find((r) => r.key === "invitation");

    expect(invitation?.override).toEqual({
      subject: "S",
      heading: "H",
      bodyText: "B",
    });
    expect(invitation?.updatedAt).toBe(updatedAt.getTime());
  });
});

describe("getCurrentAdminEmail()", () => {
  it("prüft die Berechtigung und liefert die eigene Adresse", async () => {
    mockUserFindUnique.mockResolvedValue({ email: "ada@example.com" });

    const email = await getCurrentAdminEmail();

    expect(mockRequirePermission).toHaveBeenCalledWith("mail.template.manage", {
      scope: "platform",
    });
    expect(mockUserFindUnique.mock.calls[0][0]).toEqual({
      where: { id: "admin1" },
      select: { email: true },
    });
    expect(email).toBe("ada@example.com");
  });

  it("gibt einen leeren String zurück, wenn das Konto nicht mehr existiert", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    expect(await getCurrentAdminEmail()).toBe("");
  });
});

describe("saveMailTemplate()", () => {
  it("prüft die Berechtigung, bevor irgendetwas geschrieben wird", async () => {
    mockRequirePermission.mockRejectedValue(new Error("verboten"));

    await expect(
      saveMailTemplate("invitation", {
        subject: "S",
        heading: "H",
        bodyText: "B",
      }),
    ).rejects.toThrow();
    expect(mockMailTemplateUpsert).not.toHaveBeenCalled();
  });

  it("lehnt einen unbekannten Schlüssel ab", async () => {
    const result = await saveMailTemplate("does-not-exist", {
      subject: "S",
      heading: "H",
      bodyText: "B",
    });

    expect(result).toEqual({ error: "Unbekannte Vorlage." });
    expect(mockMailTemplateUpsert).not.toHaveBeenCalled();
  });

  it("upsert't die Zeile und protokolliert den Vorgang", async () => {
    const data = { subject: "S", heading: "H", bodyText: "B" };
    const result = await saveMailTemplate("invitation", data);

    expect(result).toEqual({ ok: true });
    expect(mockMailTemplateUpsert).toHaveBeenCalledWith({
      where: { key: "invitation" },
      update: data,
      create: { key: "invitation", ...data },
    });
    expect(mockAuditCreate.mock.calls[0][0].data).toMatchObject({
      action: "mail.template.updated",
      targetType: "mailTemplate",
      targetId: "invitation",
    });
  });
});

describe("resetMailTemplate()", () => {
  it("löscht die Override-Zeile und protokolliert den Vorgang", async () => {
    const result = await resetMailTemplate("invitation");

    expect(result).toEqual({ ok: true });
    expect(mockMailTemplateDeleteMany).toHaveBeenCalledWith({
      where: { key: "invitation" },
    });
    expect(mockAuditCreate.mock.calls[0][0].data).toMatchObject({
      action: "mail.template.reset",
      targetType: "mailTemplate",
      targetId: "invitation",
    });
  });

  it("lehnt einen unbekannten Schlüssel ab", async () => {
    const result = await resetMailTemplate("does-not-exist");

    expect(result).toEqual({ error: "Unbekannte Vorlage." });
    expect(mockMailTemplateDeleteMany).not.toHaveBeenCalled();
  });
});

describe("sendTestMailTemplate()", () => {
  const draft = { subject: "", heading: "", bodyText: "" };

  it("prüft die Berechtigung", async () => {
    mockRequirePermission.mockRejectedValue(new Error("verboten"));

    await expect(
      sendTestMailTemplate("invitation", draft, "mara@example.com"),
    ).rejects.toThrow();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("lehnt einen unbekannten Schlüssel ab", async () => {
    const result = await sendTestMailTemplate(
      "does-not-exist",
      draft,
      "mara@example.com",
    );
    expect(result).toEqual({ error: "Unbekannte Vorlage." });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("lehnt eine ungültige Adresse ab", async () => {
    const result = await sendTestMailTemplate(
      "invitation",
      draft,
      "keine-adresse",
    );
    expect(result).toEqual({
      error: "Bitte eine gültige E-Mail-Adresse angeben.",
    });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("meldet fehlende SMTP-Konfiguration, statt es zu versuchen", async () => {
    mockIsMailConfigured.mockReturnValue(false);

    const result = await sendTestMailTemplate(
      "invitation",
      draft,
      "mara@example.com",
    );

    expect(result).toEqual({
      error: "SMTP ist nicht konfiguriert (SMTP_HOST fehlt).",
    });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("verschickt die Vorschau mit Beispieldaten, Betreff mit [Test]-Vorsatz", async () => {
    const result = await sendTestMailTemplate(
      "invitation",
      draft,
      "mara@example.com",
    );

    expect(result).toEqual({ ok: true });
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe("mara@example.com");
    expect(call.subject).toStartWith("[Test] ");
    expect(call.html).toContain("<!doctype html>");
  });

  it("verschickt den ungespeicherten Entwurf, nicht nur den Standard", async () => {
    await sendTestMailTemplate(
      "invitation",
      {
        subject: "Mein Entwurf für {{workspaceName}}",
        heading: "",
        bodyText: "",
      },
      "mara@example.com",
    );

    const call = mockSendMail.mock.calls[0][0];
    expect(call.subject).toBe("[Test] Mein Entwurf für Acme");
  });

  it("speichert nichts", async () => {
    await sendTestMailTemplate("invitation", draft, "mara@example.com");
    expect(mockMailTemplateUpsert).not.toHaveBeenCalled();
  });
});
