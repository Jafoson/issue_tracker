import { beforeEach, describe, expect, it, mock } from "bun:test";

// Guard (lib/platform) und Actions (features/platform) teilen sich denselben
// `db`/`session`-Mock und das ECHTE lib/platform. Wichtig: Beides in EINER Datei,
// sonst würde ein `mock.module("@/lib/platform")` zwischen den Dateien lecken
// (Bun teilt den Modul-Cache pro Prozess — siehe CLAUDE.md). react `cache` wird
// auf Identität reduziert, damit der Lookup pro Aufruf frisch ausgewertet wird.

mock.module("react", () => ({ cache: (fn: unknown) => fn }));
mock.module("next/cache", () => ({ revalidatePath: mock() }));

mock.module("@/lib/db", () => ({
  db: {
    user: { findUnique: mock(), count: mock(), update: mock() },
    workspace: { delete: mock(), update: mock() },
  },
}));

mock.module("@/lib/session", () => ({ getSession: mock() }));

import {
  deleteWorkspaceAsAdmin,
  grantPlatformAdmin,
  setUserPlatformAdmin,
  setWorkspaceSuspended,
} from "@/features/platform/actions";
import { db } from "@/lib/db";
import { PermissionError } from "@/lib/permissions";
import {
  currentUserIsPlatformAdmin,
  isUserPlatformAdmin,
  requirePlatformAdmin,
} from "@/lib/platform";
import { getSession } from "@/lib/session";

const mFindUnique = db.user.findUnique as ReturnType<typeof mock>;
const mCount = db.user.count as ReturnType<typeof mock>;
const mUserUpdate = db.user.update as ReturnType<typeof mock>;
const mWsDelete = db.workspace.delete as ReturnType<typeof mock>;
const mWsUpdate = db.workspace.update as ReturnType<typeof mock>;
const mGetSession = getSession as ReturnType<typeof mock>;

/** Eingeloggter User ist Plattform-Admin. */
function asAdmin() {
  mGetSession.mockResolvedValue({ userId: "admin-1" });
  mFindUnique.mockResolvedValue({ isPlatformAdmin: true });
}

beforeEach(() => {
  mFindUnique.mockReset();
  mCount.mockReset().mockResolvedValue(2);
  mUserUpdate.mockReset().mockResolvedValue({});
  mWsDelete.mockReset().mockResolvedValue({});
  mWsUpdate.mockReset().mockResolvedValue({});
  mGetSession.mockReset();
});

// ─── Guard (lib/platform) ──────────────────────────────────────────────────────

describe("isUserPlatformAdmin()", () => {
  it("true wenn das Flag gesetzt ist", async () => {
    mFindUnique.mockResolvedValue({ isPlatformAdmin: true });
    expect(await isUserPlatformAdmin("u1")).toBe(true);
  });

  it("false wenn das Flag nicht gesetzt ist", async () => {
    mFindUnique.mockResolvedValue({ isPlatformAdmin: false });
    expect(await isUserPlatformAdmin("u1")).toBe(false);
  });

  it("false wenn der User nicht existiert", async () => {
    mFindUnique.mockResolvedValue(null);
    expect(await isUserPlatformAdmin("ghost")).toBe(false);
  });
});

describe("currentUserIsPlatformAdmin()", () => {
  it("false ohne Session — ohne DB-Zugriff", async () => {
    mGetSession.mockResolvedValue(null);
    expect(await currentUserIsPlatformAdmin()).toBe(false);
    expect(mFindUnique).not.toHaveBeenCalled();
  });

  it("true wenn der eingeloggte User Plattform-Admin ist", async () => {
    asAdmin();
    expect(await currentUserIsPlatformAdmin()).toBe(true);
  });

  it("false wenn der eingeloggte User kein Admin ist", async () => {
    mGetSession.mockResolvedValue({ userId: "u1" });
    mFindUnique.mockResolvedValue({ isPlatformAdmin: false });
    expect(await currentUserIsPlatformAdmin()).toBe(false);
  });
});

describe("requirePlatformAdmin()", () => {
  it("wirft ohne Session", async () => {
    mGetSession.mockResolvedValue(null);
    await expect(requirePlatformAdmin()).rejects.toBeInstanceOf(
      PermissionError,
    );
    expect(mFindUnique).not.toHaveBeenCalled();
  });

  it("wirft wenn der User kein Plattform-Admin ist", async () => {
    mGetSession.mockResolvedValue({ userId: "u1" });
    mFindUnique.mockResolvedValue({ isPlatformAdmin: false });
    await expect(requirePlatformAdmin()).rejects.toBeInstanceOf(
      PermissionError,
    );
  });

  it("gibt die User-Id zurück wenn der User Plattform-Admin ist", async () => {
    asAdmin();
    expect(await requirePlatformAdmin()).toBe("admin-1");
  });
});

// ─── Actions (features/platform) ───────────────────────────────────────────────

describe("deleteWorkspaceAsAdmin()", () => {
  it("verlangt Plattform-Admin-Rechte und löscht den Workspace", async () => {
    asAdmin();
    await deleteWorkspaceAsAdmin("ws-1");
    expect(mWsDelete).toHaveBeenCalledWith({ where: { id: "ws-1" } });
  });

  it("löscht nicht, wenn der User kein Plattform-Admin ist", async () => {
    mGetSession.mockResolvedValue({ userId: "u1" });
    mFindUnique.mockResolvedValue({ isPlatformAdmin: false });
    await expect(deleteWorkspaceAsAdmin("ws-1")).rejects.toBeInstanceOf(
      PermissionError,
    );
    expect(mWsDelete).not.toHaveBeenCalled();
  });
});

describe("setWorkspaceSuspended()", () => {
  it("setzt suspended=true", async () => {
    asAdmin();
    await setWorkspaceSuspended("ws-1", true);
    expect(mWsUpdate).toHaveBeenCalledWith({
      where: { id: "ws-1" },
      data: { suspended: true },
    });
  });

  it("setzt suspended=false (entsperren)", async () => {
    asAdmin();
    await setWorkspaceSuspended("ws-1", false);
    expect(mWsUpdate).toHaveBeenCalledWith({
      where: { id: "ws-1" },
      data: { suspended: false },
    });
  });
});

describe("setUserPlatformAdmin()", () => {
  it("befördert ohne Last-Admin-Prüfung", async () => {
    asAdmin();
    await setUserPlatformAdmin("u2", true);
    expect(mCount).not.toHaveBeenCalled();
    expect(mUserUpdate).toHaveBeenCalledWith({
      where: { id: "u2" },
      data: { isPlatformAdmin: true },
    });
  });

  it("entzieht das Recht wenn weitere Admins existieren", async () => {
    asAdmin();
    mCount.mockResolvedValue(2);
    await setUserPlatformAdmin("u2", false);
    expect(mUserUpdate).toHaveBeenCalledWith({
      where: { id: "u2" },
      data: { isPlatformAdmin: false },
    });
  });

  it("wirft beim Entziehen des letzten Plattform-Admins", async () => {
    asAdmin();
    mCount.mockResolvedValue(1);
    await expect(setUserPlatformAdmin("u2", false)).rejects.toBeInstanceOf(
      PermissionError,
    );
    expect(mUserUpdate).not.toHaveBeenCalled();
  });
});

describe("grantPlatformAdmin() (FormData)", () => {
  function fd(data: Record<string, string>): FormData {
    const f = new FormData();
    for (const [k, v] of Object.entries(data)) f.append(k, v);
    return f;
  }

  it("befördert den ausgewählten User", async () => {
    asAdmin();
    await grantPlatformAdmin(fd({ userId: "u3" }));
    expect(mUserUpdate).toHaveBeenCalledWith({
      where: { id: "u3" },
      data: { isPlatformAdmin: true },
    });
  });

  it("macht nichts ohne userId", async () => {
    asAdmin();
    await grantPlatformAdmin(fd({}));
    expect(mUserUpdate).not.toHaveBeenCalled();
  });
});
