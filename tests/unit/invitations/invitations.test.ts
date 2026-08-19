import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  createInvitation,
  invitationPath,
  invitationUrl,
  newInvitationToken,
  openInvitation,
} from "@/lib/invitations";

// ── Ein Fake-Client, der nur kann, was diese Funktionen brauchen ──────────────

const deleteMany = mock();
const create = mock();
const findUnique = mock();

// biome-ignore lint/suspicious/noExplicitAny: Test-Doppel für den Prisma-Client
const db = { invitation: { deleteMany, create, findUnique } } as any;

const NOW = new Date("2026-08-04T12:00:00Z");

function reset() {
  for (const m of [deleteMany, create, findUnique]) m.mockReset();
  deleteMany.mockResolvedValue({ count: 0 });
  create.mockResolvedValue({});
}

/** Eine offene Einladung, wie die Datenbank sie liefert. */
function row(
  overrides: {
    expires?: Date;
    acceptedAt?: Date | null;
    suspended?: boolean;
    hasPasskey?: boolean;
    projectId?: string | null;
  } = {},
) {
  return {
    token: "tok",
    workspaceId: "acme",
    projectId: overrides.projectId ?? null,
    expires: overrides.expires ?? new Date("2026-08-18T12:00:00Z"),
    acceptedAt: overrides.acceptedAt ?? null,
    workspace: { name: "Acme", suspended: overrides.suspended ?? false },
    user: {
      id: "u-1",
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "",
      authenticators: overrides.hasPasskey ? [{ credentialID: "cred-1" }] : [],
    },
  };
}

describe("newInvitationToken()", () => {
  it("ist lang und url-sicher", () => {
    const token = newInvitationToken();
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("wiederholt sich nicht", () => {
    const tokens = new Set(
      Array.from({ length: 200 }, () => newInvitationToken()),
    );
    expect(tokens.size).toBe(200);
  });
});

describe("createInvitation()", () => {
  beforeEach(reset);

  it("verwirft die vorherige offene Einladung derselben Person", async () => {
    await createInvitation(db, { userId: "u-1", workspaceId: "acme" }, NOW);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: "u-1", workspaceId: "acme", acceptedAt: null },
    });
  });

  it("setzt eine Frist von 14 Tagen", async () => {
    await createInvitation(db, { userId: "u-1", workspaceId: "acme" }, NOW);
    const { data } = create.mock.calls[0][0];
    expect(data.expires).toEqual(new Date("2026-08-18T12:00:00Z"));
  });

  it("merkt sich das einladende Projekt", async () => {
    await createInvitation(
      db,
      { userId: "u-1", workspaceId: "acme", projectId: "p-1" },
      NOW,
    );
    expect(create.mock.calls[0][0].data.projectId).toBe("p-1");
  });

  it("gibt Token und Frist zurück, wie sie geschrieben wurden", async () => {
    const result = await createInvitation(
      db,
      { userId: "u-1", workspaceId: "acme" },
      NOW,
    );
    expect(create.mock.calls[0][0].data.token).toBe(result.token);
    expect(result.expiresAt).toEqual(new Date("2026-08-18T12:00:00Z"));
  });
});

describe("invitationUrl()", () => {
  it("hängt den Pfad an die Basis-URL", () => {
    expect(invitationUrl("tok")).toEndWith(invitationPath("tok"));
  });

  it("ist absolut — der Link wird kopiert und woanders geöffnet", () => {
    expect(invitationUrl("tok")).toMatch(/^https?:\/\//);
  });
});

describe("openInvitation()", () => {
  beforeEach(reset);

  it("liefert die Einladung samt Workspace-Namen", async () => {
    findUnique.mockResolvedValue(row());
    const invitation = await openInvitation(db, "tok", NOW);
    expect(invitation).toMatchObject({
      token: "tok",
      workspaceId: "acme",
      workspaceName: "Acme",
      email: "ada@example.com",
      hasPasskey: false,
    });
  });

  it("meldet ein Konto mit Passkey — das braucht keine Einladung mehr", async () => {
    findUnique.mockResolvedValue(row({ hasPasskey: true }));
    expect((await openInvitation(db, "tok", NOW))?.hasPasskey).toBe(true);
  });

  // Unbekannt, abgelaufen, benutzt, gesperrt: alle vier enden gleich, damit der
  // Endpunkt kein Orakel für gültige Tokens ist.
  it("gibt null für einen unbekannten Token", async () => {
    findUnique.mockResolvedValue(null);
    expect(await openInvitation(db, "tok", NOW)).toBeNull();
  });

  it("gibt null für einen leeren Token, ohne die Datenbank zu fragen", async () => {
    expect(await openInvitation(db, "", NOW)).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("gibt null für eine abgelaufene Einladung", async () => {
    findUnique.mockResolvedValue(row({ expires: new Date("2026-08-01") }));
    expect(await openInvitation(db, "tok", NOW)).toBeNull();
  });

  it("gibt null für eine schon angenommene Einladung", async () => {
    findUnique.mockResolvedValue(row({ acceptedAt: new Date("2026-08-02") }));
    expect(await openInvitation(db, "tok", NOW)).toBeNull();
  });

  it("gibt null, wenn der Workspace gesperrt ist", async () => {
    findUnique.mockResolvedValue(row({ suspended: true }));
    expect(await openInvitation(db, "tok", NOW)).toBeNull();
  });
});
