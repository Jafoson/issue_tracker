import { describe, expect, it } from "bun:test";
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLES,
  type Permission,
  roleRank,
} from "@/lib/rbac";

function role(key: string) {
  const r = DEFAULT_ROLES.find((x) => x.key === key);
  if (!r) throw new Error(`role ${key} missing`);
  return r;
}
function perms(key: string): Set<Permission> {
  return new Set(role(key).permissions);
}

describe("RBAC-Rollenmatrix (lib/rbac.ts)", () => {
  it("definiert genau 7 Default-Rollen", () => {
    expect(DEFAULT_ROLES.map((r) => r.key)).toEqual([
      "owner",
      "admin",
      "manager",
      "project_lead",
      "member",
      "viewer",
      "guest",
    ]);
  });

  it("hat keine Duplikate in den Permission-Listen", () => {
    for (const r of DEFAULT_ROLES) {
      expect(new Set(r.permissions).size).toBe(r.permissions.length);
    }
  });

  it("referenziert nur gültige Permission-Keys", () => {
    const valid = new Set<string>(ALL_PERMISSIONS);
    for (const r of DEFAULT_ROLES) {
      for (const p of r.permissions) expect(valid.has(p)).toBe(true);
    }
  });

  describe("Owner", () => {
    it("hat alle Permissions", () => {
      expect(perms("owner").size).toBe(ALL_PERMISSIONS.length);
    });
    it("ist unveränderlich (editable=false)", () => {
      expect(role("owner").editable).toBe(false);
    });
  });

  describe("Admin", () => {
    it("hat alles außer workspace.delete", () => {
      expect(perms("admin").has("workspace.delete")).toBe(false);
      expect(perms("admin").size).toBe(ALL_PERMISSIONS.length - 1);
    });
    it("darf Rollen verwalten", () => {
      expect(perms("admin").has("workspace.role.manage")).toBe(true);
    });
  });

  describe("Manager", () => {
    it("darf weder löschen noch Rollen verwalten", () => {
      expect(perms("manager").has("workspace.delete")).toBe(false);
      expect(perms("manager").has("workspace.role.manage")).toBe(false);
    });
    it("verwaltet Mitglieder und Teams", () => {
      expect(perms("manager").has("workspace.member.invite")).toBe(true);
      expect(perms("manager").has("workspace.team.create")).toBe(true);
    });
  });

  describe("Project Lead", () => {
    it("hat keinen Workspace-Verwaltungszugriff", () => {
      expect(perms("project_lead").has("workspace.member.invite")).toBe(false);
      expect(perms("project_lead").has("workspace.settings.update")).toBe(
        false,
      );
    });
    it("kann Projekte erstellen und hat vollen Projektzugriff", () => {
      expect(perms("project_lead").has("workspace.project.create")).toBe(true);
      expect(perms("project_lead").has("project.issue.update.any")).toBe(true);
      expect(perms("project_lead").has("project.delete")).toBe(true);
    });
  });

  describe("Member", () => {
    it("darf nur eigene Issues bearbeiten/löschen", () => {
      const m = perms("member");
      expect(m.has("project.issue.update.own")).toBe(true);
      expect(m.has("project.issue.update.any")).toBe(false);
      expect(m.has("project.issue.delete.own")).toBe(true);
      expect(m.has("project.issue.delete.any")).toBe(false);
    });
    it("darf Issues erstellen, zuweisen und kommentieren", () => {
      const m = perms("member");
      expect(m.has("project.issue.create")).toBe(true);
      expect(m.has("project.issue.assign")).toBe(true);
      expect(m.has("project.comment.create")).toBe(true);
    });
  });

  describe("Viewer & Guest", () => {
    const expected: Permission[] = [
      "project.view",
      "project.comment.create",
      "project.comment.delete.own",
    ];
    it("Viewer hat nur Lese- + eigene Kommentar-Rechte", () => {
      expect([...perms("viewer")].sort()).toEqual([...expected].sort());
    });
    it("Guest hat dieselben Rechte wie Viewer", () => {
      expect([...perms("guest")].sort()).toEqual([...expected].sort());
    });
    it("Viewer/Guest dürfen keine Issues erstellen", () => {
      expect(perms("viewer").has("project.issue.create")).toBe(false);
      expect(perms("guest").has("project.issue.create")).toBe(false);
    });
  });

  describe("Rang-Hierarchie", () => {
    it("ordnet owner > admin > manager > project_lead > member > viewer > guest", () => {
      expect(roleRank("owner")).toBeGreaterThan(roleRank("admin"));
      expect(roleRank("admin")).toBeGreaterThan(roleRank("manager"));
      expect(roleRank("manager")).toBeGreaterThan(roleRank("project_lead"));
      expect(roleRank("project_lead")).toBeGreaterThan(roleRank("member"));
      expect(roleRank("member")).toBeGreaterThan(roleRank("viewer"));
      expect(roleRank("viewer")).toBeGreaterThan(roleRank("guest"));
    });
    it("liefert -1 für unbekannte Rollen", () => {
      expect(roleRank("nope")).toBe(-1);
    });
  });
});
