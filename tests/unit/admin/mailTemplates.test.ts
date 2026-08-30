import { beforeEach, describe, expect, it, mock } from "bun:test";

// Mail template management: `getMailTemplates` (merges catalog + DB
// override) and `saveMailTemplate`/`resetMailTemplate` (admin actions).

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
  it("checks the permission", async () => {
    await getMailTemplates();
    expect(mockRequirePermission).toHaveBeenCalledWith("mail.template.manage", {
      scope: "platform",
    });
  });

  it("returns every catalog key exactly once, without an override", async () => {
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

  it("merges an existing DB row into the matching catalog entry", async () => {
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
  it("checks the permission and returns the user's own address", async () => {
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

  it("returns an empty string when the account no longer exists", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    expect(await getCurrentAdminEmail()).toBe("");
  });
});

describe("saveMailTemplate()", () => {
  it("checks the permission before anything is written", async () => {
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

  it("rejects an unknown key", async () => {
    const result = await saveMailTemplate("does-not-exist", {
      subject: "S",
      heading: "H",
      bodyText: "B",
    });

    expect(result).toEqual({ error: "Unknown template." });
    expect(mockMailTemplateUpsert).not.toHaveBeenCalled();
  });

  it("upserts the row and logs the action", async () => {
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
  it("deletes the override row and logs the action", async () => {
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

  it("rejects an unknown key", async () => {
    const result = await resetMailTemplate("does-not-exist");

    expect(result).toEqual({ error: "Unknown template." });
    expect(mockMailTemplateDeleteMany).not.toHaveBeenCalled();
  });
});

describe("sendTestMailTemplate()", () => {
  const draft = { subject: "", heading: "", bodyText: "" };

  it("checks the permission", async () => {
    mockRequirePermission.mockRejectedValue(new Error("verboten"));

    await expect(
      sendTestMailTemplate("invitation", draft, "mara@example.com"),
    ).rejects.toThrow();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("rejects an unknown key", async () => {
    const result = await sendTestMailTemplate(
      "does-not-exist",
      draft,
      "mara@example.com",
    );
    expect(result).toEqual({ error: "Unknown template." });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("rejects an invalid address", async () => {
    const result = await sendTestMailTemplate(
      "invitation",
      draft,
      "keine-adresse",
    );
    expect(result).toEqual({
      error: "Please provide a valid email address.",
    });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("reports missing SMTP configuration instead of attempting it", async () => {
    mockIsMailConfigured.mockReturnValue(false);

    const result = await sendTestMailTemplate(
      "invitation",
      draft,
      "mara@example.com",
    );

    expect(result).toEqual({
      error: "SMTP is not configured (SMTP_HOST is missing).",
    });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("sends the preview with sample data, subject prefixed with [Test]", async () => {
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

  it("sends the unsaved draft, not just the default", async () => {
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

  it("saves nothing", async () => {
    await sendTestMailTemplate("invitation", draft, "mara@example.com");
    expect(mockMailTemplateUpsert).not.toHaveBeenCalled();
  });
});
