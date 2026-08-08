import { beforeEach, describe, expect, it, mock } from "bun:test";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRoleFindUnique = mock();
const mockRoleFindFirst = mock();
const mockRoleCreate = mock();
const mockRoleUpdate = mock();
const mockRoleDelete = mock();
const mockGrantUpsert = mock();
const mockGrantDeleteMany = mock();
// Die Stapel-Action schickt ihre Schreibvorgänge als Transaktion los. Der Mock
// wartet sie einfach ab — geprüft wird hier, *was* geschrieben wird.
const mockTransaction = mock((ops: unknown[]) => Promise.all(ops));

mock.module("@/lib/db", () => ({
  db: {
    role: {
      findUnique: mockRoleFindUnique,
      findFirst: mockRoleFindFirst,
      create: mockRoleCreate,
      update: mockRoleUpdate,
      delete: mockRoleDelete,
    },
    rolePermission: {
      upsert: mockGrantUpsert,
      deleteMany: mockGrantDeleteMany,
    },
    $transaction: mockTransaction,
  },
}));

const mockAccessFor = mock();
const mockCurrentUserId = mock<() => Promise<string | null>>();

mock.module("@/lib/permissions", () => ({
  PLATFORM: { scope: "platform" },
  accessFor: mockAccessFor,
  currentUserId: mockCurrentUserId,
  assignmentCeiling: (
    access: {
      roleKey: (l: string) => string | null;
      rank: (l: string) => number;
    },
    level: string,
  ) =>
    access.roleKey(level) === null
      ? Number.POSITIVE_INFINITY
      : access.rank(level),
}));

mock.module("next/cache", () => ({ revalidatePath: mock() }));

import {
  createRole,
  deleteRole,
  setRoleGrant,
  setRoleGrants,
  updateRole,
} from "@/features/roles/actions";
import type { RoleTarget } from "@/features/roles/types";

// ── Helfer ────────────────────────────────────────────────────────────────────

const WS_TARGET: RoleTarget = { scope: "WORKSPACE", workspaceId: "ws1" };

/** Ein Handelnder mit den angegebenen Rechten und einem Rang je Ebene. */
function actor(permissions: string[], ranks: Record<string, number> = {}) {
  return {
    has: (p: string) => permissions.includes(p),
    rank: (level: string) => ranks[level] ?? -1,
    roleKey: (level: string) => (level in ranks ? "some-role" : null),
    workspaceId: "ws1",
    projectId: null,
  };
}

/** Die Rolle, die `requireRoleManage` laden wird. */
function existingRole(
  overrides: Partial<{
    id: string;
    rank: number;
    editable: boolean;
    system: boolean;
    scope: "PLATFORM" | "WORKSPACE" | "PROJECT";
    workspaceId: string | null;
    projectId: string | null;
  }> = {},
) {
  return {
    id: "ws:ws1:custom",
    rank: 2,
    editable: true,
    scope: "WORKSPACE" as const,
    system: false,
    workspaceId: "ws1",
    projectId: null,
    ...overrides,
  };
}

beforeEach(() => {
  mock.clearAllMocks();
  mockCurrentUserId.mockResolvedValue("u1");
  mockRoleFindFirst.mockResolvedValue(null);
  mockRoleCreate.mockResolvedValue({});
  mockRoleUpdate.mockResolvedValue({});
  mockRoleDelete.mockResolvedValue({});
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Zugang zur Rollenverwaltung", () => {
  it("verlangt eine Session", async () => {
    mockCurrentUserId.mockResolvedValue(null);
    const result = await createRole(WS_TARGET, { name: "Reviewer" });
    expect(result).toEqual({ error: "You must be logged in." });
    expect(mockRoleCreate).not.toHaveBeenCalled();
  });

  it("verlangt die passende Permission der Ebene", async () => {
    mockAccessFor.mockResolvedValue(actor([]));
    const result = await createRole(WS_TARGET, { name: "Reviewer" });
    expect(result).toEqual({
      error: "You are not allowed to manage roles here.",
    });
    expect(mockRoleCreate).not.toHaveBeenCalled();
  });

  it("misst role.manage im Kontext des Topfes", async () => {
    // `role.manage` ist überall derselbe Key — welcher Topf gemeint ist, sagt
    // allein der Kontext. Wer den Workspace verwalten darf, kommt damit nicht
    // an die Plattform-Rollen heran.
    mockAccessFor.mockImplementation(
      async (_id: string, ctx: Record<string, unknown>) =>
        "workspaceId" in ctx
          ? actor(["role.manage"], { WORKSPACE: 5 })
          : actor([]),
    );

    expect(
      await createRole({ scope: "PLATFORM" }, { name: "Support" }),
    ).toEqual({ error: "You are not allowed to manage roles here." });
    expect(await createRole(WS_TARGET, { name: "Reviewer" })).toEqual({
      ok: true,
    });
  });
});

describe("Rang-Grenze", () => {
  it("verweigert eine Rolle über dem eigenen Rang", async () => {
    mockAccessFor.mockResolvedValue(actor(["role.manage"], { WORKSPACE: 4 }));
    const result = await createRole(WS_TARGET, { name: "Über", rank: 5 });
    expect(result).toEqual({
      error: "You cannot create a role above your own rank.",
    });
  });

  it("erlaubt eine Rolle auf dem eigenen Rang", async () => {
    mockAccessFor.mockResolvedValue(actor(["role.manage"], { WORKSPACE: 4 }));
    const result = await createRole(WS_TARGET, { name: "Gleichauf", rank: 4 });
    expect(result).toEqual({ ok: true });
    expect(mockRoleCreate).toHaveBeenCalled();
  });

  it("lässt eine Rolle über dem eigenen Rang nicht bearbeiten", async () => {
    mockRoleFindUnique.mockResolvedValue(existingRole({ rank: 6 }));
    mockAccessFor.mockResolvedValue(actor(["role.manage"], { WORKSPACE: 4 }));
    const result = await updateRole("ws:ws1:owner", { name: "Neu" });
    expect(result).toEqual({
      error: "You cannot change a role ranked above your own.",
    });
    expect(mockRoleUpdate).not.toHaveBeenCalled();
  });

  it("verweigert das Anheben über den eigenen Rang", async () => {
    mockRoleFindUnique.mockResolvedValue(existingRole({ rank: 2 }));
    mockAccessFor.mockResolvedValue(actor(["role.manage"], { WORKSPACE: 4 }));
    const result = await updateRole("ws:ws1:custom", { rank: 9 });
    expect(result).toEqual({
      error: "You cannot raise a role above your own rank.",
    });
  });
});

describe("Geteilte und geschützte Rollen", () => {
  const shared = {
    error:
      "This is a shared default role and cannot be changed. Create your own role instead.",
  };

  beforeEach(() => {
    mockAccessFor.mockResolvedValue(actor(["role.manage"], { WORKSPACE: 6 }));
  });

  it("lässt eine geteilte System-Rolle unangetastet", async () => {
    // Sie ist für alle Mandanten dieselbe Zeile — eine Änderung träfe jeden.
    mockRoleFindUnique.mockResolvedValue(existingRole({ system: true }));
    expect(await updateRole("sys:WORKSPACE:member", { name: "Neu" })).toEqual(
      shared,
    );
    expect(mockRoleUpdate).not.toHaveBeenCalled();
  });

  it("verweigert auch das Löschen einer geteilten Rolle", async () => {
    mockRoleFindUnique.mockResolvedValue(existingRole({ system: true }));
    expect(await deleteRole("sys:WORKSPACE:member")).toEqual(shared);
    expect(mockRoleDelete).not.toHaveBeenCalled();
  });

  it("verweigert Permission-Änderungen an einer geteilten Rolle", async () => {
    mockRoleFindUnique.mockResolvedValue(existingRole({ system: true }));
    expect(
      await setRoleGrant("sys:WORKSPACE:member", "team.create", true),
    ).toEqual(shared);
    expect(mockGrantUpsert).not.toHaveBeenCalled();
  });

  it("lässt `editable: false` auch bei eigenen Rollen unangetastet", async () => {
    mockRoleFindUnique.mockResolvedValue(existingRole({ editable: false }));
    expect(await updateRole("ws:ws1:custom", { name: "Neu" })).toEqual({
      error: "This role is protected and cannot be changed.",
    });
  });
});

describe("Keine Rechte-Eskalation", () => {
  const manage = ["role.manage"];

  beforeEach(() => {
    mockRoleFindUnique.mockResolvedValue(existingRole());
  });

  it("verweigert ALLOW für eine Permission, die der Handelnde nicht hat", async () => {
    mockAccessFor.mockResolvedValue(actor(manage, { WORKSPACE: 5 }));
    const result = await setRoleGrant(
      "ws:ws1:custom",
      "workspace.delete",
      true,
    );
    expect(result).toEqual({
      error: "You cannot grant a permission you do not have.",
    });
    expect(mockGrantUpsert).not.toHaveBeenCalled();
  });

  it("erlaubt ALLOW für eine Permission, die er selbst hat", async () => {
    mockAccessFor.mockResolvedValue(
      actor([...manage, "team.create"], { WORKSPACE: 5 }),
    );
    const result = await setRoleGrant("ws:ws1:custom", "team.create", true);
    expect(result).toEqual({ ok: true });
    expect(mockGrantUpsert).toHaveBeenCalled();
  });

  it("erlaubt das Wegnehmen auch ohne die Permission selbst zu haben", async () => {
    // Wegnehmen vergrößert niemandes Rechte — das ist kein Eskalationsweg.
    mockAccessFor.mockResolvedValue(actor(manage, { WORKSPACE: 5 }));
    const result = await setRoleGrant(
      "ws:ws1:custom",
      "workspace.delete",
      false,
    );
    expect(result).toEqual({ ok: true });
    expect(mockGrantDeleteMany).toHaveBeenCalled();
    expect(mockGrantUpsert).not.toHaveBeenCalled();
  });

  it("nimmt einen Eintrag mit `null` zurück", async () => {
    mockAccessFor.mockResolvedValue(actor(manage, { WORKSPACE: 5 }));
    const result = await setRoleGrant("ws:ws1:custom", "team.create", false);
    expect(result).toEqual({ ok: true });
    expect(mockGrantDeleteMany).toHaveBeenCalled();
    expect(mockGrantUpsert).not.toHaveBeenCalled();
  });
});

describe("Scope-Grenze der Permissions", () => {
  it("weist eine workspace-eigene Permission in einer Projektrolle ab", async () => {
    mockRoleFindUnique.mockResolvedValue(
      existingRole({ scope: "PROJECT", projectId: "p1" }),
    );
    mockAccessFor.mockResolvedValue(
      actor(["role.manage", "workspace.update"], { PROJECT: 4 }),
    );
    const result = await setRoleGrant("pr:p1:custom", "workspace.update", true);
    expect(result).toEqual({
      error: "That permission does not apply in this scope.",
    });
  });

  it("nimmt dieselbe Permission in beiden Mandanten-Scopes an", async () => {
    // `label.create` gilt laut Registry im Workspace und im Projekt.
    mockRoleFindUnique.mockResolvedValue(
      existingRole({ scope: "PROJECT", projectId: "p1" }),
    );
    mockAccessFor.mockResolvedValue(
      actor(["role.manage", "label.create"], { PROJECT: 4 }),
    );
    expect(await setRoleGrant("pr:p1:custom", "label.create", true)).toEqual({
      ok: true,
    });
  });

  it("weist eine Projekt-Permission in einer Workspace-Rolle ab", async () => {
    // Was nur im Projekt gilt, gehört in eine Projektrolle. Eine Workspace-Rolle
    // damit zu bestücken wäre wirkungslos — der Resolver übergeht solche Keys.
    mockRoleFindUnique.mockResolvedValue(existingRole());
    mockAccessFor.mockResolvedValue(actor(["role.manage"], { WORKSPACE: 5 }));
    const result = await setRoleGrant("ws:ws1:custom", "issue.create", true);
    expect(result).toEqual({
      error: "That permission does not apply in this scope.",
    });
  });

  it("misst den Handelnden bei einer workspaceweiten Projektrolle am Generalschlüssel", async () => {
    // Diese Rollen gelten in allen Projekten und werden deshalb im
    // Workspace-Kontext verwaltet — dort stehen aber keine Projektrechte mehr.
    // Gemessen wird der Handelnde an dem Schlüssel, der ihm alle Projekte
    // öffnet; sonst könnte er auf einer solchen Rolle gar nichts erlauben.
    mockRoleFindUnique.mockResolvedValue(
      existingRole({
        id: "wsp:ws1:triage",
        scope: "PROJECT",
        workspaceId: "ws1",
        projectId: null,
      }),
    );
    mockAccessFor.mockResolvedValue(
      actor(["role.manage", "project.admin.all"], { WORKSPACE: 5 }),
    );

    expect(await setRoleGrant("wsp:ws1:triage", "issue.create", true)).toEqual({
      ok: true,
    });
  });

  it("lässt ohne den Generalschlüssel keine Projektrechte vergeben", async () => {
    // Ein Workspace-Manager verwaltet Rollen, greift aber nicht in die Projekte
    // durch — er kann dort also auch keine Rechte verteilen.
    mockRoleFindUnique.mockResolvedValue(
      existingRole({
        id: "wsp:ws1:triage",
        scope: "PROJECT",
        workspaceId: "ws1",
        projectId: null,
      }),
    );
    mockAccessFor.mockResolvedValue(
      actor(["role.manage", "issue.create"], { WORKSPACE: 4 }),
    );

    expect(await setRoleGrant("wsp:ws1:triage", "issue.create", true)).toEqual({
      error: "You cannot grant a permission you do not have.",
    });
  });

  it("weist einen unbekannten Permission-Key ab", async () => {
    mockRoleFindUnique.mockResolvedValue(existingRole());
    mockAccessFor.mockResolvedValue(actor(["role.manage"], { WORKSPACE: 5 }));
    // Der alte, präfixbehaftete Name existiert nicht mehr.
    const result = await setRoleGrant(
      "ws:ws1:custom",
      "project.issue.create",
      true,
    );
    expect(result).toEqual({ error: "Unknown permission." });
  });
});

describe("Stapel aus der Matrix", () => {
  // Der Speichern-Knopf schickt alles auf einmal — die Action muss deshalb
  // mehrere Rollen in einem Aufruf vertragen und darf keine halben Stapel
  // hinterlassen.
  beforeEach(() => {
    mockAccessFor.mockResolvedValue(
      actor(["role.manage", "team.create", "audit.view"], { WORKSPACE: 5 }),
    );
    mockRoleFindUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) =>
        existingRole({ id: where.id }),
    );
  });

  it("schreibt Erlauben und Zurücknehmen über mehrere Rollen hinweg", async () => {
    const result = await setRoleGrants([
      { roleId: "ws:ws1:a", permission: "team.create", granted: true },
      { roleId: "ws:ws1:b", permission: "audit.view", granted: false },
    ]);

    expect(result).toEqual({ ok: true });
    expect(mockGrantUpsert).toHaveBeenCalledTimes(1);
    expect(mockGrantDeleteMany).toHaveBeenCalledTimes(1);
    // Ein Zug, nicht zwei: sonst stünde nach einem Fehler die Hälfte in der DB.
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("prüft jede Rolle einmal, nicht jede Zelle", async () => {
    await setRoleGrants([
      { roleId: "ws:ws1:custom", permission: "team.create", granted: true },
      { roleId: "ws:ws1:custom", permission: "audit.view", granted: false },
      { roleId: "ws:ws1:custom", permission: "team.delete", granted: false },
    ]);

    expect(mockRoleFindUnique).toHaveBeenCalledTimes(1);
  });

  it("verwirft den ganzen Stapel, wenn eine Zelle unzulässig ist", async () => {
    const result = await setRoleGrants([
      { roleId: "ws:ws1:custom", permission: "team.create", granted: true },
      // Die hat der Handelnde selbst nicht.
      {
        roleId: "ws:ws1:custom",
        permission: "workspace.delete",
        granted: true,
      },
    ]);

    expect(result).toEqual({
      error: "You cannot grant a permission you do not have.",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockGrantUpsert).not.toHaveBeenCalled();
    expect(mockGrantDeleteMany).not.toHaveBeenCalled();
  });

  it("hält auch an einer gesperrten Rolle den ganzen Stapel auf", async () => {
    mockRoleFindUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) =>
        existingRole({ id: where.id, system: where.id.startsWith("sys:") }),
    );

    const result = await setRoleGrants([
      { roleId: "ws:ws1:custom", permission: "team.create", granted: true },
      {
        roleId: "sys:WORKSPACE:member",
        permission: "team.create",
        granted: false,
      },
    ]);

    expect(result).toEqual({
      error:
        "This is a shared default role and cannot be changed. Create your own role instead.",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("lässt einen leeren Stapel gelten, ohne die DB anzufassen", async () => {
    expect(await setRoleGrants([])).toEqual({ ok: true });
    expect(mockRoleFindUnique).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});

describe("Löschen", () => {
  beforeEach(() => {
    mockAccessFor.mockResolvedValue(actor(["role.manage"], { WORKSPACE: 5 }));
  });

  it("verweigert das Löschen, solange jemand die Rolle trägt", async () => {
    mockRoleFindUnique
      .mockResolvedValueOnce(existingRole())
      .mockResolvedValueOnce({
        _count: { workspaceMembers: 3, projectMembers: 0, globalUsers: 0 },
      });

    const result = await deleteRole("ws:ws1:custom");
    expect(result).toEqual({
      error: "Someone still has this role. Move them to another one first.",
    });
    expect(mockRoleDelete).not.toHaveBeenCalled();
  });

  it("löscht eine Rolle, die niemand trägt", async () => {
    mockRoleFindUnique
      .mockResolvedValueOnce(existingRole())
      .mockResolvedValueOnce({
        _count: { workspaceMembers: 0, projectMembers: 0, globalUsers: 0 },
      });

    const result = await deleteRole("ws:ws1:custom");
    expect(result).toEqual({ ok: true });
    expect(mockRoleDelete).toHaveBeenCalledWith({
      where: { id: "ws:ws1:custom" },
    });
  });
});

describe("Anlegen", () => {
  beforeEach(() => {
    mockAccessFor.mockResolvedValue(actor(["role.manage"], { WORKSPACE: 5 }));
  });

  it("verlangt einen Namen", async () => {
    const result = await createRole(WS_TARGET, { name: "   " });
    expect(result).toEqual({ error: "Name is required." });
  });

  it("leitet den Key aus dem Namen ab und setzt den Eigentümer", async () => {
    await createRole(WS_TARGET, { name: "Code Reviewer" });

    const data = mockRoleCreate.mock.calls[0][0].data;
    expect(data.key).toBe("code-reviewer");
    expect(data.id).toBe("ws:ws1:code-reviewer");
    expect(data.scope).toBe("WORKSPACE");
    expect(data.workspaceId).toBe("ws1");
    expect(data.projectId).toBeNull();
    // Eigene Rollen sind nie geteilt und immer editierbar.
    expect(data.system).toBe(false);
    expect(data.editable).toBe(true);
  });

  it("weicht einem belegten Key aus", async () => {
    mockRoleFindFirst
      .mockResolvedValueOnce({ id: "ws:ws1:reviewer" })
      .mockResolvedValueOnce(null);

    await createRole(WS_TARGET, { name: "Reviewer" });
    expect(mockRoleCreate.mock.calls[0][0].data.key).toBe("reviewer-2");
  });

  it("legt projektlokale Rollen am Projekt an", async () => {
    mockAccessFor.mockResolvedValue(actor(["role.manage"], { PROJECT: 4 }));
    await createRole(
      { scope: "PROJECT", workspaceId: "ws1", projectId: "p1" },
      { name: "Triage" },
    );

    const data = mockRoleCreate.mock.calls[0][0].data;
    expect(data.id).toBe("pr:p1:triage");
    expect(data.scope).toBe("PROJECT");
    expect(data.projectId).toBe("p1");
    expect(data.workspaceId).toBe("ws1");
  });
});
