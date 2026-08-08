import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockTx = {
  user: { update: mock() },
  workspaceMember: { findUnique: mock(), update: mock() },
  project: { findMany: mock() },
  projectMember: { createMany: mock() },
  invitation: { update: mock() },
};

const mockTransaction = mock();
const mockInvitationFindUnique = mock();

mock.module("@/lib/db", () => ({
  db: {
    user: { findUnique: mock(), create: mock() },
    // `openInvitation` läuft hier echt — nur die Zeile kommt aus dem Mock. Ein
    // Mock des Moduls würde in andere Test-Dateien lecken (Bun teilt den
    // Modul-Cache innerhalb eines Prozesses, siehe CLAUDE.md).
    invitation: { findUnique: mockInvitationFindUnique },
    $transaction: mockTransaction,
  },
}));

class AuthError extends Error {}
mock.module("next-auth", () => ({ AuthError }));

const mockSignIn = mock();
mock.module("@/auth", () => ({ signIn: mockSignIn, signOut: mock() }));

mock.module("bcryptjs", () => ({
  default: { compare: mock(), hash: mock(async () => "hashed") },
}));

import { acceptInvitation } from "@/features/auth/actions";

function form(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.append(k, v);
  return fd;
}

/** Eine offene Einladung, wie die Datenbank sie liefert. */
const VALID_ROW = {
  token: "tok",
  workspaceId: "acme",
  projectId: null,
  expires: new Date("2099-01-01"),
  acceptedAt: null,
  workspace: { name: "Acme", suspended: false },
  user: {
    id: "u-1",
    email: "ada@example.com",
    firstName: "Ada",
    lastName: "",
    passwordHash: null,
  },
};

const GOOD = { firstName: "Ada", lastName: "Lovelace", password: "supersafe1" };

function reset() {
  for (const group of Object.values(mockTx)) {
    for (const fn of Object.values(group)) {
      fn.mockReset();
      fn.mockResolvedValue({});
    }
  }
  // Zwei Leser derselben Zeile: die Action fragt `pending`, das Nachziehen der
  // Projekte fragt die Rollen-Einträge.
  mockTx.workspaceMember.findUnique.mockResolvedValue({
    pending: true,
    role: {
      permissions: [
        { permissionKey: "project.view" },
        { permissionKey: "issue.create" },
      ],
    },
  });
  mockTx.project.findMany.mockResolvedValue([{ id: "p-1" }]);

  mockTransaction.mockReset();
  mockTransaction.mockImplementation(
    async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
  );

  mockInvitationFindUnique.mockReset();
  mockInvitationFindUnique.mockResolvedValue(VALID_ROW);
  mockSignIn.mockReset();
  mockSignIn.mockResolvedValue(undefined);
}

describe("acceptInvitation() — Eingaben", () => {
  beforeEach(reset);

  it("verlangt einen Vornamen", async () => {
    expect(
      await acceptInvitation("tok", form({ ...GOOD, firstName: " " })),
    ).toEqual({ error: "Please enter your first name." });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("verlangt mindestens acht Zeichen Passwort", async () => {
    expect(
      await acceptInvitation("tok", form({ ...GOOD, password: "kurz" })),
    ).toEqual({ error: "Password must be at least 8 characters." });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  // Unbekannt, abgelaufen, benutzt: `openInvitation` unterscheidet das nicht, und
  // diese Meldung tut es auch nicht.
  it("lehnt eine ungültige Einladung ab", async () => {
    mockInvitationFindUnique.mockResolvedValue(null);
    expect(await acceptInvitation("tok", form(GOOD))).toEqual({
      error: "This invitation is no longer valid. Ask for a new one.",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

describe("acceptInvitation() — Zugang einrichten", () => {
  beforeEach(reset);

  it("setzt Name und Passwort-Hash", async () => {
    await acceptInvitation("tok", form(GOOD));
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: "u-1" },
      data: {
        firstName: "Ada",
        lastName: "Lovelace",
        passwordHash: "hashed",
      },
    });
  });

  it("hebt pending auf — erst damit greifen die Rechte der Rolle", async () => {
    await acceptInvitation("tok", form(GOOD));
    expect(mockTx.workspaceMember.update).toHaveBeenCalledWith({
      where: { workspaceId_userId: { workspaceId: "acme", userId: "u-1" } },
      data: { pending: false },
    });
  });

  it("nimmt die Person in die öffentlichen Projekte auf", async () => {
    await acceptInvitation("tok", form(GOOD));
    expect(mockTx.project.findMany.mock.calls[0][0].where.visibility).toBe(
      "public",
    );
    expect(mockTx.projectMember.createMany).toHaveBeenCalled();
  });

  it("verbraucht den Token", async () => {
    await acceptInvitation("tok", form(GOOD));
    const call = mockTx.invitation.update.mock.calls[0][0];
    expect(call.where).toEqual({ token: "tok" });
    expect(call.data.acceptedAt).toBeInstanceOf(Date);
  });

  it("meldet danach an und schickt in den Workspace", async () => {
    expect(await acceptInvitation("tok", form(GOOD))).toEqual({
      redirectTo: "/acme",
    });
    expect(mockSignIn).toHaveBeenCalledWith("credentials", {
      email: "ada@example.com",
      password: GOOD.password,
      redirect: false,
    });
  });

  it("schickt zur Anmeldung, wenn der Login scheitert — der Zugang steht ja", async () => {
    mockSignIn.mockRejectedValue(new AuthError("nope"));
    expect(await acceptInvitation("tok", form(GOOD))).toEqual({
      redirectTo: "/login",
    });
    expect(mockTx.invitation.update).toHaveBeenCalled();
  });
});

describe("acceptInvitation() — Projekt-Gast", () => {
  beforeEach(reset);

  it("lässt einen Gast ohne Workspace-Mitgliedschaft in Ruhe", async () => {
    // Kein `WorkspaceMember`: der Zugriff hängt allein an der Projektzeile, die
    // schon steht. Zu heben gibt es hier nichts.
    mockTx.workspaceMember.findUnique.mockResolvedValue(null);

    await acceptInvitation("tok", form(GOOD));

    expect(mockTx.user.update).toHaveBeenCalled();
    expect(mockTx.workspaceMember.update).not.toHaveBeenCalled();
    expect(mockTx.projectMember.createMany).not.toHaveBeenCalled();
    expect(mockTx.invitation.update).toHaveBeenCalled();
  });

  it("rührt eine schon angenommene Mitgliedschaft nicht an", async () => {
    mockTx.workspaceMember.findUnique.mockResolvedValue({
      pending: false,
      role: { permissions: [] },
    });
    await acceptInvitation("tok", form(GOOD));
    expect(mockTx.workspaceMember.update).not.toHaveBeenCalled();
  });
});
