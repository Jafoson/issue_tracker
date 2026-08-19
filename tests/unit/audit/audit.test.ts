import { beforeEach, describe, expect, it, mock } from "bun:test";

// Das Protokoll selbst: was beim Schreiben festgehalten wird, und was passiert,
// wenn dabei etwas schiefgeht.

const mockAuditCreate = mock();
const mockAuditFindMany = mock();
const mockAuditCount = mock();
const mockUserFindUnique = mock();
const mockUserFindMany = mock();
const mockProjectFindMany = mock();
const mockWorkspaceFindMany = mock();

mock.module("@/lib/db", () => ({
  db: {
    auditLog: {
      create: mockAuditCreate,
      findMany: mockAuditFindMany,
      count: mockAuditCount,
    },
    user: { findUnique: mockUserFindUnique, findMany: mockUserFindMany },
    project: { findMany: mockProjectFindMany },
    workspace: { findMany: mockWorkspaceFindMany },
  },
}));

import {
  AUDIT_ACTION_KEYS,
  listAudit,
  parseTargetLabel,
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
    color: "#6e63e6",
  });
  mockUserFindMany.mockResolvedValue([]);
  mockProjectFindMany.mockResolvedValue([]);
  mockWorkspaceFindMany.mockResolvedValue([]);
});

describe("Schreiben", () => {
  it("friert Name und Adresse des Handelnden ein", async () => {
    await recordAudit({ action: "auth.login", actorId: "u1" });

    expect(mockAuditCreate.mock.calls[0][0].data.actorLabel).toBe(
      "Ada Lovelace (ada@example.com)",
    );
  });

  it("friert die Kontofarbe für den Avatar ein", async () => {
    await recordAudit({ action: "auth.login", actorId: "u1" });
    expect(mockAuditCreate.mock.calls[0][0].data.actorColor).toBe("#6e63e6");
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

    const entry = mockAuditCreate.mock.calls[0][0].data;
    expect(entry.actorLabel).toBe("Unbekannt");
    // Keine Farbe ohne Konto — die Liste zeigt dann den Platzhalter-Avatar.
    expect(entry.actorColor).toBeNull();
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

  it("liest neueste zuerst, inklusive `meta` für Status-/Prioritäts-/Label-Icons", async () => {
    await listAudit();

    const args = mockAuditFindMany.mock.calls[0][0];
    expect(args.orderBy).toEqual({ createdAt: "desc" });
    expect(args.take).toBe(100);
    expect(args.select.meta).toBe(true);
    expect(args.select.actorColor).toBe(true);
  });

  it("schränkt auf einen Workspace ein und blendet Projekt-Tagesgeschäft aus", async () => {
    // Ohne projectId ist das der Workspace-Feed: Issues und projektgebundene
    // Labels gehören zu einem einzelnen Projekt, nicht zum Workspace als
    // Ganzes, auch wenn sie `workspaceId` tragen (siehe `whereFor`).
    await listAudit({ workspaceId: "ws1" });
    expect(mockAuditFindMany.mock.calls[0][0].where).toEqual({
      workspaceId: "ws1",
      NOT: [
        { action: { startsWith: "issue." } },
        { action: "label.created", projectId: { not: null } },
        { action: "label.deleted", projectId: { not: null } },
      ],
    });
  });

  it("lässt Issue- und Label-Vorgänge im Projekt-Feed unberührt", async () => {
    // Mit projectId (Projekt-Feed) greift der Workspace-Ausschluss nicht —
    // dort gehören Issues und Labels gerade hin.
    await listAudit({ projectId: "p1" });
    expect(mockAuditFindMany.mock.calls[0][0].where).toEqual({
      projectId: "p1",
    });
  });

  it("filtert ohne Angaben gar nicht", async () => {
    await listAudit();
    expect(mockAuditFindMany.mock.calls[0][0].where).toEqual({});
  });

  it("ergänzt die aktuelle Farbe für Zeilen ohne eingefrorene", async () => {
    // Vor der `actorColor`-Spalte entstandene Zeilen — die Liste soll trotzdem
    // einen Avatar zeigen können, statt für immer beim Platzhalter zu bleiben.
    mockAuditFindMany.mockResolvedValue([
      { id: "a1", actorId: "u1", actorColor: null },
      { id: "a2", actorId: "u2", actorColor: "#already-frozen" },
      { id: "a3", actorId: null, actorColor: null },
    ]);
    mockUserFindMany.mockResolvedValue([{ id: "u1", color: "#current" }]);

    const entries = await listAudit();

    // Nur die eine fehlende Farbe wird nachgefragt — nicht die schon
    // eingefrorene und nicht die ohne Konto.
    expect(mockUserFindMany.mock.calls[0][0].where.id.in).toEqual(["u1"]);
    expect(entries).toMatchObject([
      { id: "a1", actorId: "u1", actorColor: "#current" },
      { id: "a2", actorId: "u2", actorColor: "#already-frozen" },
      { id: "a3", actorId: null, actorColor: null },
    ]);
  });

  it("fragt für die Farbe nicht erneut nach, wenn jede Zeile schon eine trägt — nur noch für den Avatar", async () => {
    mockAuditFindMany.mockResolvedValue([
      { id: "a1", actorId: "u1", actorColor: "#frozen" },
    ]);

    await listAudit();

    // Das Profilbild ist nie eingefroren (siehe `AuditEntry.actorAvatarUrl`)
    // und wird deshalb immer live nachgeschlagen — auch wenn die Farbe schon
    // eingefroren ist. Genau ein Aufruf statt zwei: nicht mehr für die Farbe.
    expect(mockUserFindMany).toHaveBeenCalledTimes(1);
    expect(mockUserFindMany.mock.calls[0][0].select).toEqual({
      id: true,
      avatarKey: true,
    });
  });

  it("löst Profilbild, Farbe, Slug und Name des Projekts hinter `projectId` auf", async () => {
    mockAuditFindMany.mockResolvedValue([
      { id: "a1", actorId: "u1", actorColor: "#frozen", projectId: "p1" },
    ]);
    mockProjectFindMany.mockResolvedValue([
      { id: "p1", slug: "mobile", name: "Mobile App", color: "#3b82f6" },
    ]);

    const entries = await listAudit();

    expect(mockProjectFindMany.mock.calls[0][0].where.id.in).toEqual(["p1"]);
    expect(entries[0].projectRef).toEqual({
      slug: "mobile",
      name: "Mobile App",
      color: "#3b82f6",
      avatarUrl: null,
    });
  });

  it("löst Profilbild, Farbe, Slug und Name des Workspace hinter `workspaceId` auf", async () => {
    mockAuditFindMany.mockResolvedValue([
      { id: "a1", actorId: "u1", actorColor: "#frozen", workspaceId: "ws1" },
    ]);
    mockWorkspaceFindMany.mockResolvedValue([
      { id: "ws1", slug: "nimbus", name: "Nimbus", color: "#6e63e6" },
    ]);

    const entries = await listAudit();

    expect(mockWorkspaceFindMany.mock.calls[0][0].where.id.in).toEqual(["ws1"]);
    expect(entries[0].workspaceRef).toEqual({
      slug: "nimbus",
      name: "Nimbus",
      color: "#6e63e6",
      avatarUrl: null,
    });
  });

  it("lässt `workspaceRef` leer, wenn der Workspace inzwischen gelöscht ist", async () => {
    mockAuditFindMany.mockResolvedValue([
      { id: "a1", actorId: "u1", actorColor: "#frozen", workspaceId: "ws-weg" },
    ]);
    mockWorkspaceFindMany.mockResolvedValue([]);

    const entries = await listAudit();

    expect(entries[0].workspaceRef).toBeNull();
  });

  it("lässt `projectRef` leer, wenn keine Zeile eine `projectId` trägt", async () => {
    mockAuditFindMany.mockResolvedValue([
      { id: "a1", actorId: "u1", actorColor: "#frozen", projectId: null },
    ]);

    const entries = await listAudit();

    expect(mockProjectFindMany).not.toHaveBeenCalled();
    expect(entries[0].projectRef).toBeNull();
  });

  it("lässt `projectRef` leer, wenn das Projekt inzwischen gelöscht ist", async () => {
    mockAuditFindMany.mockResolvedValue([
      { id: "a1", actorId: "u1", actorColor: "#frozen", projectId: "p-weg" },
    ]);
    mockProjectFindMany.mockResolvedValue([]);

    const entries = await listAudit();

    expect(entries[0].projectRef).toBeNull();
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

describe("parseTargetLabel", () => {
  it("zerlegt Kürzel und Alt-Neu", () => {
    expect(parseTargetLabel("MOB-1: Offen → In Arbeit")).toEqual({
      ref: "MOB-1",
      before: "Offen",
      after: "In Arbeit",
    });
  });

  it("zerlegt Kürzel ohne Rest", () => {
    expect(parseTargetLabel("MOB-1")).toEqual({ ref: "MOB-1" });
  });

  it("zerlegt Kürzel mit Rest ohne Pfeil", () => {
    expect(parseTargetLabel("MOB-1: Fix login bug")).toEqual({
      ref: "MOB-1",
      after: "Fix login bug",
    });
  });

  it("lässt Text ohne erkennbares Kürzel unangetastet", () => {
    expect(parseTargetLabel("Ada Lovelace")).toEqual({
      after: "Ada Lovelace",
    });
  });

  it("erkennt ein einstelliges Kürzel genauso wie ein vierstelliges", () => {
    expect(parseTargetLabel("A-1: Titel")).toEqual({
      ref: "A-1",
      after: "Titel",
    });
    expect(parseTargetLabel("ABCD-42: Titel")).toEqual({
      ref: "ABCD-42",
      after: "Titel",
    });
  });
});
