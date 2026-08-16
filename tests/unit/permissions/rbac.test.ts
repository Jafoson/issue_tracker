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
    // Für Objekte, die es auf beiden Ebenen wirklich gibt: der Scope der Rolle
    // entscheidet, welches der beiden gemeint ist.
    for (const key of [
      "label.create",
      "member.invite",
      "role.manage",
    ] as Permission[]) {
      expect(isPermissionAllowedIn(key, "WORKSPACE")).toBe(true);
      expect(isPermissionAllowedIn(key, "PROJECT")).toBe(true);
    }
  });

  it("hält rein projektbezogene Permissions aus dem Workspace heraus", () => {
    // Sonst könnte eine Workspace-Rolle an der Projektrolle vorbei in jedes
    // Projekt hineinregieren — genau das soll die Trennung verhindern.
    for (const key of [
      "issue.create",
      "issue.update.any",
      "comment.create",
      "project.view",
      "project.update",
      "project.delete",
    ] as Permission[]) {
      expect(isPermissionAllowedIn(key, "WORKSPACE")).toBe(false);
      expect(isPermissionAllowedIn(key, "PROJECT")).toBe(true);
    }
  });

  it("hält die Generalschlüssel des Workspace aus den Projektrollen heraus", () => {
    // Ein Projekt kann sich nicht selbst die Schlüssel zu allen anderen geben.
    for (const key of [
      "project.view.all",
      "project.admin.all",
    ] as Permission[]) {
      expect(isPermissionAllowedIn(key, "WORKSPACE")).toBe(true);
      expect(isPermissionAllowedIn(key, "PROJECT")).toBe(false);
      expect(isPermissionAllowedIn(key, "PLATFORM")).toBe(false);
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
      "project.create",
      "project.view.all",
      "team.create",
    ] as Permission[]) {
      expect(isPermissionAllowedIn(key, "WORKSPACE")).toBe(true);
      expect(isPermissionAllowedIn(key, "PROJECT")).toBe(false);
    }
  });

  // `audit.view` gilt inzwischen in allen drei Scopes — derselbe Key, drei
  // Ausschnitte desselben Protokolls (siehe `lib/rbac/permissions.ts`).
  it("gibt `audit.view` in Plattform, Workspace und Projekt", () => {
    expect(isPermissionAllowedIn("audit.view", "PLATFORM")).toBe(true);
    expect(isPermissionAllowedIn("audit.view", "WORKSPACE")).toBe(true);
    expect(isPermissionAllowedIn("audit.view", "PROJECT")).toBe(true);
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
          for (const p of r.allow) {
            expect(isPermissionAllowedIn(p, r.scope)).toBe(true);
          }
        }
      });

      it("referenziert nur gültige Keys und wiederholt keinen", () => {
        const valid = new Set<string>(ALL_PERMISSIONS);
        for (const r of roles) {
          expect(new Set(r.allow).size).toBe(r.allow.length);
          for (const p of r.allow) expect(valid.has(p)).toBe(true);
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

    it("gibt den Generalschlüssel nur der Leitung des Workspace", () => {
      const opensAll = systemRolesIn("WORKSPACE")
        .filter((r) => r.allow.includes("project.admin.all"))
        .map((r) => r.key);
      expect(opensAll).toEqual(["owner", "admin", "project_lead"]);
      // Wer durchgreifen darf, sieht auch alles — sonst wäre der Durchgriff auf
      // Projekte beschränkt, die er ohnehin schon findet.
      for (const key of opensAll) {
        expect(role(key).allow).toContain("project.view.all");
      }
    });

    it("trägt in keiner Rolle Projektrechte", () => {
      // Was im Projekt gilt, steht in der Projektrolle. Eine Workspace-Rolle,
      // die Issue-Rechte trüge, wäre wirkungslos und damit irreführend.
      for (const r of systemRolesIn("WORKSPACE")) {
        for (const key of r.allow) {
          expect(isPermissionAllowedIn(key, "WORKSPACE")).toBe(true);
        }
      }
    });

    it("nennt für jede Rolle die Projektrolle bei der Aufnahme", () => {
      // Ohne diese Angabe müsste die Aufnahme aus Workspace-Rechten erraten,
      // was jemand im Projekt darf — die stehen dort aber nicht mehr.
      const projectKeys = systemRolesIn("PROJECT").map((r) => r.key);
      for (const r of systemRolesIn("WORKSPACE")) {
        expect(r.defaultProjectRoleKey).toBeDefined();
        expect(projectKeys).toContain(r.defaultProjectRoleKey as string);
      }
    });
  });

  describe("Scope PROJECT", () => {
    const READ_AND_COMMENT: Permission[] = [
      "project.view",
      "comment.create",
      "comment.delete.own",
    ];

    it("beschränkt die einschränkenden Rollen allein über ihre Liste", () => {
      // Eine Rolle nennt nur, was sie erlaubt. Da im Projekt allein die
      // Projektrolle zählt, ist „nicht aufgeführt" bereits das Verbot — und
      // eine neu eingeführte Projekt-Permission damit automatisch gesperrt,
      // ohne dass jemand eine Verbotsliste pflegt.
      for (const key of ["project_viewer", "project_guest"]) {
        expect([...role(key).allow].sort()).toEqual(
          [...READ_AND_COMMENT].sort(),
        );
      }
    });

    it("sperrt mit `blocked` jeden Projektzugriff", () => {
      // Die leere Liste ist der ganze Ausschluss. Was `blocked` von „gar keine
      // Zeile in ProjectMember" unterscheidet, steht nicht hier, sondern in der
      // Aufnahme: `enrollWorkspaceMembers` schreibt mit `skipDuplicates` und
      // lässt eine bestehende Zeile in Ruhe. Wer entfernt wurde, kommt beim
      // Umschalten auf öffentlich zurück; wer blockiert ist, bleibt draußen.
      expect(role("blocked").allow).toEqual([]);
    });

    it("gibt project_admin alles seines Scopes", () => {
      expect(role("project_admin").allow.length).toBe(
        permissionsFor("PROJECT").length,
      );
    });
  });
});
