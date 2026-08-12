import { beforeEach, describe, expect, it, mock } from "bun:test";

// Das Protokoll selbst: was beim Schreiben festgehalten wird, und was passiert,
// wenn dabei etwas schiefgeht.

const mockAuditCreate = mock();
const mockAuditFindMany = mock();
const mockAuditCount = mock();
const mockUserFindUnique = mock();

mock.module("@/lib/db", () => ({
  db: {
    auditLog: {
      create: mockAuditCreate,
      findMany: mockAuditFindMany,
      count: mockAuditCount,
    },
    user: { findUnique: mockUserFindUnique },
  },
}));

import {
  AUDIT_ACTION_KEYS,
  listAudit,
  recordAudit,
  recordAuditIn,
  toAuditAction,
} from "@/lib/audit";

beforeEach(() => {
  mock.clearAllMocks();
  mockAuditCreate.mockResolvedValue({});
  mockAuditFindMany.mockResolvedValue([]);
  mockAuditCount.mockResolvedValue(0);
  mockUserFindUnique.mockResolvedValue({
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
  });
});

describe("Schreiben", () => {
  it("friert Name und Adresse des Handelnden ein", async () => {
    await recordAudit({ action: "auth.login", actorId: "u1" });

    expect(mockAuditCreate.mock.calls[0][0].data.actorLabel).toBe(
      "Ada Lovelace (ada@example.com)",
    );
  });

  it("nimmt ohne Id die mitgegebene Beschriftung", async () => {
    // Der fehlgeschlagene Anmeldeversuch: es steht niemand fest, nur eine
    // getippte Adresse.
    await recordAudit({
      action: "auth.login.failed",
      actorLabel: "  wer@auch.immer  ",
    });

    const entry = mockAuditCreate.mock.calls[0][0].data;
    expect(entry.actorId).toBeNull();
    expect(entry.actorLabel).toBe("wer@auch.immer");
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it("behilft sich, wenn das Konto schon weg ist", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    await recordAudit({ action: "user.deactivated", actorId: "geloescht" });

    expect(mockAuditCreate.mock.calls[0][0].data.actorLabel).toBe("Unbekannt");
  });

  it("macht aus einer leeren Begründung kein leeres Feld", async () => {
    await recordAudit({ action: "auth.login", actorId: "u1", reason: "   " });
    expect(mockAuditCreate.mock.calls[0][0].data.reason).toBeNull();
  });

  it("lässt die Handlung nicht scheitern, wenn das Protokoll klemmt", async () => {
    // Eine Anmeldung soll nicht daran hängen, dass die Protokolltabelle
    // gerade nicht erreichbar ist.
    const error = console.error;
    console.error = () => {};
    mockAuditCreate.mockRejectedValueOnce(new Error("DB weg"));

    expect(
      await recordAudit({ action: "auth.login", actorId: "u1" }),
    ).toBeUndefined();

    console.error = error;
  });

  it("reicht den Fehler durch, wo der Eintrag die Bedingung ist", async () => {
    // `recordAuditIn` läuft in der Transaktion des Aufrufers. Schluckte es hier
    // den Fehler, entstünde genau der Zustand, den es verhindern soll: Zugriff
    // ohne Spur.
    const client = {
      auditLog: {
        create: mock(async () => {
          throw new Error("DB weg");
        }),
      },
      user: { findUnique: mockUserFindUnique },
    };

    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: schmaler Test-Klient
      recordAuditIn(client as any, {
        action: "project.breakglass",
        actorId: "u1",
      }),
    ).rejects.toThrow("DB weg");
  });
});

describe("Lesen", () => {
  it("begrenzt die Menge, auch wenn jemand mehr verlangt", async () => {
    await listAudit({ limit: 10_000 });
    expect(mockAuditFindMany.mock.calls[0][0].take).toBe(500);
  });

  it("liest neueste zuerst und ohne `meta`", async () => {
    await listAudit();

    const args = mockAuditFindMany.mock.calls[0][0];
    expect(args.orderBy).toEqual({ createdAt: "desc" });
    expect(args.take).toBe(100);
    expect(args.select.meta).toBeUndefined();
  });

  it("schränkt auf einen Workspace ein, wenn einer verlangt wird", async () => {
    await listAudit({ workspaceId: "ws1" });
    expect(mockAuditFindMany.mock.calls[0][0].where).toEqual({
      workspaceId: "ws1",
    });
  });

  it("filtert ohne Angaben gar nicht", async () => {
    await listAudit();
    expect(mockAuditFindMany.mock.calls[0][0].where).toEqual({});
  });
});

describe("Schlüssel", () => {
  it("erkennt bekannte Vorgänge", () => {
    expect(toAuditAction("project.breakglass")).toBe("project.breakglass");
  });

  it("gibt bei einem unbekannten null zurück", () => {
    // Das Protokoll ist älter als jede Fassung der Oberfläche.
    expect(toAuditAction("etwas.ganz.neues")).toBeNull();
  });

  it("führt jeden Vorgang genau einmal", () => {
    expect(new Set(AUDIT_ACTION_KEYS).size).toBe(AUDIT_ACTION_KEYS.length);
  });
});
