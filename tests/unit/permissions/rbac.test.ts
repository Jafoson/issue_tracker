import { describe, expect, it } from "bun:test";
import {
  ALL_PERMISSIONS,
  isPermissionAllowedIn,
  PERMISSIONS,
  type Permission,
  permissionDesc,
  permissionsFor,
  ROLE_SCOPES,
  type RoleScope,
  SYSTEM_ROLES,
  type SystemRole,
  systemRoleId,
  systemRolesIn,
  toPermission,
  toRoleScope,
} from "@/lib/rbac";

// Die Registry ist reine Datendefinition. Diese Tests halten sie in sich
// stimmig: ein Key nennt nur Objekt und Aktion, jede Rolle trägt nur
// Permissions, die in ihrem Scope überhaupt vergeben werden dürfen, und die
// Ränge bleiben je Scope eindeutig.

function role(key: string): SystemRole {
  const found = SYSTEM_ROLES.find((r) => r.key === key);
  if (!found) throw new Error(`Rolle ${key} fehlt`);
  return found;
}

describe("Permission-Registry (lib/rbac/permissions.ts)", () => {
  it("beschreibt jede Permission und kennt keine Duplikate", () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
    for (const key of ALL_PERMISSIONS) {
      expect(permissionDesc(key).length).toBeGreaterThan(0);
    }
  });

  it("nennt keine Ebene im Key — nur Objekt und Aktion", () => {
    // Genau das war der Grund für den Umbau: `workspace.label.create` und
    // `project.label.create` sind derselbe Vorgang in verschiedenen Scopes.
    for (const key of ALL_PERMISSIONS) {
      expect(key.startsWith("workspace.label")).toBe(false);
      expect(key.startsWith("project.label")).toBe(false);
      expect(key.startsWith("project.issue")).toBe(false);
      expect(key.startsWith("project.comment")).toBe(false);
      expect(key.startsWith("workspace.member")).toBe(false);
      expect(key.startsWith("workspace.team")).toBe(false);
    }
  });

  it("führt jede Permission in mindestens einem Scope", () => {
    for (const key of ALL_PERMISSIONS) {
      expect(PERMISSIONS[key].scopes.length).toBeGreaterThan(0);
      for (const scope of PERMISSIONS[key].scopes) {
        expect(ROLE_SCOPES).toContain(scope);
      }
    }
  });

  it("lässt dieselbe Permission in Workspace und Projekt gelten", () => {
    // Das ist der Kern des Modells: der Scope der Rolle entscheidet, wo sie wirkt.
    for (const key of [
      "label.create",
      "issue.create",
      "comment.create",
      "member.invite",
    ] as Permission[]) {
      expect(isPermissionAllowedIn(key, "WORKSPACE")).toBe(true);
      expect(isPermissionAllowedIn(key, "PROJECT")).toBe(true);
    }
  });

  it("hält Plattform-Permissions aus den Mandanten-Scopes heraus", () => {
    for (const key of [
      "platform.access",
      "user.manage",
      "tenant.access",
      "workspace.suspend",
    ] as Permission[]) {
      expect(isPermissionAllowedIn(key, "WORKSPACE")).toBe(false);
      expect(isPermissionAllowedIn(key, "PROJECT")).toBe(false);
      expect(isPermissionAllowedIn(key, "PLATFORM")).toBe(true);
    }
  });

  it("hält workspace-eigene Permissions aus dem Projekt-Scope heraus", () => {
    for (const key of [
      "workspace.update",
      "config.manage",
      "audit.view",
      "project.create",
      "project.view.all",
      "team.create",
    ] as Permission[]) {
      expect(isPermissionAllowedIn(key, "WORKSPACE")).toBe(true);
      expect(isPermissionAllowedIn(key, "PROJECT")).toBe(false);
    }
  });

  it("gibt `role.manage` in allen drei Scopes", () => {
    // Eine Permission, drei Bedeutungen — abhängig davon, wo sie hängt.
    for (const scope of ROLE_SCOPES) {
      expect(isPermissionAllowedIn("role.manage", scope)).toBe(true);
    }
  });

  it("narrowt fremde Strings sicher", () => {
    expect(toPermission("issue.create")).toBe("issue.create");
    expect(toPermission("project.issue.create")).toBeNull();
    expect(toPermission("")).toBeNull();
    expect(toRoleScope("WORKSPACE")).toBe("WORKSPACE");
    expect(toRoleScope("GLOBAL")).toBeNull();
  });
});

describe("System-Rollen (lib/rbac/roles.ts)", () => {
  it("existieren je genau einmal — keine Kopien je Mandant", () => {
    const ids = SYSTEM_ROLES.map((r) => systemRoleId(r.scope, r.key));
    expect(new Set(ids).size).toBe(ids.length);
    // Die Id trägt keinen Workspace und kein Projekt.
    for (const id of ids) expect(id.startsWith("sys:")).toBe(true);
  });

  it("verteilt sich auf die drei Scopes", () => {
    expect(systemRolesIn("PLATFORM").map((r) => r.key)).toEqual([
      "platform_admin",
      "platform_support",
      "platform_member",
    ]);
    expect(systemRolesIn("WORKSPACE").map((r) => r.key)).toEqual([
      "owner",
      "admin",
      "manager",
      "project_lead",
      "member",
      "viewer",
      "guest",
    ]);
    expect(systemRolesIn("PROJECT").map((r) => r.key)).toEqual([
      "project_admin",
      "contributor",
      "project_viewer",
      "project_guest",
      "blocked",
    ]);
  });

  for (const scope of ROLE_SCOPES) {
    describe(scope, () => {
      const roles = systemRolesIn(scope as RoleScope);

      it("trägt nur Permissions, die in diesem Scope vergeben werden dürfen", () => {
        for (const r of roles) {
          for (const p of [...r.allow, ...r.deny]) {
            expect(isPermissionAllowedIn(p, r.scope)).toBe(true);
          }
        }
      });

      it("referenziert nur gültige Keys und wiederholt keinen", () => {
        const valid = new Set<string>(ALL_PERMISSIONS);
        for (const r of roles) {
          expect(new Set(r.allow).size).toBe(r.allow.length);
          expect(new Set(r.deny).size).toBe(r.deny.length);
          for (const p of [...r.allow, ...r.deny])
            expect(valid.has(p)).toBe(true);
        }
      });

      it("setzt eine Permission nie gleichzeitig auf ALLOW und DENY", () => {
        for (const r of roles) {
          const allowed = new Set<Permission>(r.allow);
          for (const p of r.deny) expect(allowed.has(p)).toBe(false);
        }
      });

      it("vergibt jeden Rang nur einmal", () => {
        const ranks = roles.map((r) => r.rank);
        expect(new Set(ranks).size).toBe(ranks.length);
      });
    });
  }

  describe("Scope PLATFORM", () => {
    it("gibt platform_admin bewusst KEINEN Mandanten-Zugriff", () => {
      const admin = role("platform_admin");
      expect(admin.allow).not.toContain("tenant.access");
      // …aber alles andere des Scopes.
      expect(admin.allow.length).toBe(permissionsFor("PLATFORM").length - 1);
    });

    it("bündelt den Mandanten-Zugriff in platform_support", () => {
      const support = role("platform_support");
      expect(support.allow).toContain("tenant.access");
      expect(support.allow).not.toContain("user.manage");
    });

    it("lässt die Nullrolle rechtelos", () => {
      const member = role("platform_member");
      expect(member.allow).toEqual([]);
      expect(member.deny).toEqual([]);
    });
  });

  describe("Scope WORKSPACE", () => {
    it("gibt dem Owner alles seines Scopes", () => {
      expect(role("owner").allow.length).toBe(
        permissionsFor("WORKSPACE").length,
      );
    });

    it("nimmt dem Admin nur workspace.delete", () => {
      const admin = role("admin");
      expect(admin.allow).not.toContain("workspace.delete");
      expect(admin.allow).toContain("role.manage");
    });

    it("hält den Manager aus Rollen und privaten Projekten heraus", () => {
      const manager = role("manager");
      expect(manager.allow).not.toContain("role.manage");
      expect(manager.allow).not.toContain("project.view.all");
      expect(manager.allow).toContain("member.invite");
    });

    it("gibt nur Owner und Admin Einblick in alle Projekte", () => {
      const seesAll = systemRolesIn("WORKSPACE")
        .filter((r) => r.allow.includes("project.view.all"))
        .map((r) => r.key);
      expect(seesAll).toEqual(["owner", "admin"]);
    });

    it("lässt den Member nur Eigenes bearbeiten", () => {
      const member = role("member");
      expect(member.allow).toContain("issue.update.own");
      expect(member.allow).not.toContain("issue.update.any");
    });
  });

  describe("Scope PROJECT", () => {
    const READ_AND_COMMENT: Permission[] = [
      "project.view",
      "comment.create",
      "comment.delete.own",
    ];

    it("verbietet bei den einschränkenden Rollen erschöpfend", () => {
      // Der Kern der Herabstufung: was nicht erlaubt ist, muss ausdrücklich
      // verboten sein — sonst reicht die Workspace-Rolle die Rechte durch.
      for (const key of ["project_viewer", "project_guest"]) {
        const r = role(key);
        expect([...r.allow].sort()).toEqual([...READ_AND_COMMENT].sort());
        expect(r.allow.length + r.deny.length).toBe(
          permissionsFor("PROJECT").length,
        );
      }
    });

    it("sperrt mit `blocked` jeden Projektzugriff", () => {
      const blocked = role("blocked");
      expect(blocked.allow).toEqual([]);
      expect([...blocked.deny].sort()).toEqual(
        [...permissionsFor("PROJECT")].sort(),
      );
    });

    it("lässt die additiven Rollen ohne Verbote", () => {
      expect(role("project_admin").deny).toEqual([]);
      expect(role("contributor").deny).toEqual([]);
    });

    it("gibt project_admin alles seines Scopes", () => {
      expect(role("project_admin").allow.length).toBe(
        permissionsFor("PROJECT").length,
      );
    });
  });
});
