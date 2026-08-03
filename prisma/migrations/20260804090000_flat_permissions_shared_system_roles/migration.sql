-- Flache Permissions + geteilte System-Rollen
--
-- Vorher trug jeder Permission-Key seine Ebene im Namen
-- (`workspace.label.create` vs. `project.label.create`), und jeder Workspace
-- bekam eine eigene Kopie aller Default-Rollen — bei zwei Workspaces schon 428
-- RolePermission-Zeilen mit nur 214 verschiedenen Inhalten.
--
-- Danach nennt ein Key nur Objekt und Aktion (`label.create`); wo er wirkt,
-- sagt der Scope der Rolle, die ihn trägt. Die Default-Rollen liegen genau
-- einmal in der Datenbank, gehören niemandem und werden von allen Mandanten
-- geteilt. Eigene Rollen hängen weiterhin am Workspace oder am Projekt.

-- ─── 1. Enum: RoleLevel → RoleScope, GLOBAL → PLATFORM ───────────────────────

ALTER TYPE "RoleLevel" RENAME TO "RoleScope";
ALTER TYPE "RoleScope" RENAME VALUE 'GLOBAL' TO 'PLATFORM';

-- ─── 2. Spalten umbenennen ───────────────────────────────────────────────────

ALTER TABLE "Role" RENAME COLUMN "level" TO "scope";
ALTER TABLE "User" RENAME COLUMN "globalRoleId" TO "platformRoleId";
ALTER TABLE "User" RENAME CONSTRAINT "User_globalRoleId_fkey" TO "User_platformRoleId_fkey";

-- ─── 3. Permission-Keys zusammenführen ───────────────────────────────────────

-- Die Ebenen-Spalte zuerst auflösen: sie war NOT NULL und wurde von keinem
-- Anwendungscode gelesen. In welchen Scopes eine Permission vergeben werden
-- darf, steht jetzt in der Registry (lib/rbac/permissions.ts).
ALTER TABLE "Permission" DROP COLUMN "level";

CREATE TEMP TABLE "key_map" (old text NOT NULL, new text NOT NULL) ON COMMIT DROP;

-- Neue Permission-Keys (aus lib/rbac/permissions.ts erzeugt)
INSERT INTO "Permission" ("key", "desc") VALUES
  ('platform.access', 'Zugang zum Plattform-Bereich (/admin)'),
  ('user.manage', 'Benutzerkonten plattformweit verwalten'),
  ('tenant.access', 'Inhalte aller Workspaces einsehen und bearbeiten (Support-Zugriff)'),
  ('workspace.suspend', 'Workspaces sperren und entsperren'),
  ('workspace.update', 'Name, Farbe und Slug des Workspace ändern'),
  ('workspace.delete', 'Workspace unwiderruflich löschen'),
  ('config.manage', 'Status, Prioritäten und Issue-Typen verwalten'),
  ('audit.view', 'Audit-Log einsehen'),
  ('role.manage', 'Rollen dieses Scopes definieren und Berechtigungen zuweisen'),
  ('member.invite', 'Mitglieder hinzufügen und einladen'),
  ('member.remove', 'Mitglieder entfernen'),
  ('member.role.update', 'Rolle eines anderen Mitglieds ändern'),
  ('project.create', 'Neues Projekt im Workspace anlegen'),
  ('project.view', 'Projekt sehen (relevant für private Projekte)'),
  ('project.view.all', 'Alle Projekte sehen, auch private ohne Mitgliedschaft'),
  ('project.update', 'Projektname, Präfix und Farbe ändern'),
  ('project.delete', 'Projekt löschen'),
  ('team.create', 'Team erstellen'),
  ('team.update', 'Team-Name, Farbe und Lead ändern'),
  ('team.delete', 'Team löschen'),
  ('team.member.manage', 'Mitglieder zu Teams hinzufügen oder entfernen'),
  ('team.project.manage', 'Projekte Teams zuordnen oder entfernen'),
  ('label.create', 'Label anlegen'),
  ('label.update', 'Label bearbeiten'),
  ('label.delete', 'Label löschen'),
  ('issue.create', 'Issue erstellen'),
  ('issue.update.any', 'Beliebige Issues bearbeiten'),
  ('issue.update.own', 'Nur eigene Issues bearbeiten (Reporter oder Assignee)'),
  ('issue.delete.any', 'Beliebige Issues löschen'),
  ('issue.delete.own', 'Nur eigene Issues löschen'),
  ('issue.assign', 'Issues anderen Mitgliedern zuweisen'),
  ('comment.create', 'Kommentar zu einem Issue schreiben'),
  ('comment.delete.any', 'Beliebige Kommentare löschen'),
  ('comment.delete.own', 'Nur eigene Kommentare löschen')
ON CONFLICT ("key") DO NOTHING;

-- Zuordnung alter auf neuer Key. Mehrere Ziele je Quelle sind erlaubt.
INSERT INTO "key_map" (old, new) VALUES
  ('platform.admin.access', 'platform.access'),
  ('platform.user.manage', 'user.manage'),
  ('platform.workspace.access', 'tenant.access'),
  ('platform.workspace.suspend', 'workspace.suspend'),
  ('platform.workspace.delete', 'workspace.delete'),
  ('platform.role.manage', 'role.manage'),
  ('workspace.delete', 'workspace.delete'),
  ('workspace.role.manage', 'role.manage'),
  ('workspace.settings.update', 'workspace.update'),
  ('workspace.config.manage', 'config.manage'),
  ('workspace.audit.view', 'audit.view'),
  ('workspace.member.invite', 'member.invite'),
  ('workspace.member.remove', 'member.remove'),
  ('workspace.member.role.update', 'member.role.update'),
  ('workspace.project.create', 'project.create'),
  ('workspace.project.view.all', 'project.view.all'),
  ('workspace.team.create', 'team.create'),
  ('workspace.team.update', 'team.update'),
  ('workspace.team.delete', 'team.delete'),
  ('workspace.team.member.manage', 'team.member.manage'),
  ('workspace.team.project.manage', 'team.project.manage'),
  ('workspace.label.create', 'label.create'),
  ('workspace.label.update', 'label.update'),
  ('workspace.label.delete', 'label.delete'),
  ('project.role.manage', 'role.manage'),
  ('project.view', 'project.view'),
  ('project.settings.update', 'project.update'),
  ('project.delete', 'project.delete'),
  ('project.member.manage', 'member.invite'),
  ('project.member.manage', 'member.remove'),
  ('project.member.manage', 'member.role.update'),
  ('project.issue.create', 'issue.create'),
  ('project.issue.update.any', 'issue.update.any'),
  ('project.issue.update.own', 'issue.update.own'),
  ('project.issue.delete.any', 'issue.delete.any'),
  ('project.issue.delete.own', 'issue.delete.own'),
  ('project.issue.assign', 'issue.assign'),
  ('project.comment.create', 'comment.create'),
  ('project.comment.delete.any', 'comment.delete.any'),
  ('project.comment.delete.own', 'comment.delete.own'),
  ('project.label.create', 'label.create'),
  ('project.label.update', 'label.update'),
  ('project.label.delete', 'label.delete');
-- 41 alte Keys → 34 neue

-- Jeder bestehende Eintrag muss zugeordnet sein — sonst bricht die Migration
-- lieber ab, als Berechtigungen stillschweigend zu verlieren.
DO $$
DECLARE fehlend text;
BEGIN
  SELECT string_agg(DISTINCT rp."permissionKey", ', ') INTO fehlend
  FROM "RolePermission" rp
  WHERE NOT EXISTS (SELECT 1 FROM "key_map" m WHERE m.old = rp."permissionKey");
  IF fehlend IS NOT NULL THEN
    RAISE EXCEPTION 'Nicht zugeordnete Permission-Keys: %', fehlend;
  END IF;
END $$;

-- Umschreiben. Fallen zwei alte Keys auf denselben neuen, gewinnt DENY — das
-- entspricht der Auswertung im Resolver.
CREATE TEMP TABLE "new_grants" ON COMMIT DROP AS
SELECT rp."roleId",
       m.new AS "permissionKey",
       (CASE WHEN bool_or(rp.effect = 'DENY') THEN 'DENY' ELSE 'ALLOW' END)::"PermissionEffect" AS effect
  FROM "RolePermission" rp
  JOIN "key_map" m ON m.old = rp."permissionKey"
 GROUP BY rp."roleId", m.new;

DELETE FROM "RolePermission";
INSERT INTO "RolePermission" ("roleId", "permissionKey", "effect")
SELECT "roleId", "permissionKey", effect FROM "new_grants";

DELETE FROM "Permission" WHERE "key" IN (SELECT old FROM "key_map" WHERE old <> new);

-- ─── 4. System-Rollen zusammenlegen ──────────────────────────────────────────
--
-- Aus n Kopien je (Scope, Key) wird eine Zeile `sys:<scope>:<key>` ohne
-- Eigentümer. Name, Beschreibung und Rang kommen aus dem ersten Vorkommen —
-- die Kopien waren ohnehin identisch.
--
-- Die alten Constraints müssen vorher fallen: während der Zusammenlegung
-- existieren geteilte Zeile und Kopie kurz nebeneinander, und der bisherige
-- Unique-Index über (scope, key) würde das verbieten.

ALTER TABLE "Role" DROP CONSTRAINT IF EXISTS "Role_scope_check";
DROP INDEX IF EXISTS "Role_global_key";
DROP INDEX IF EXISTS "Role_ws_key";
DROP INDEX IF EXISTS "Role_ws_proj_key";
DROP INDEX IF EXISTS "Role_proj_key";
DROP INDEX IF EXISTS "Role_level_workspaceId_idx";

INSERT INTO "Role" (id, scope, "workspaceId", "projectId", key, name, "desc", rank, editable, system)
SELECT DISTINCT ON (r.scope, r.key)
       'sys:' || r.scope || ':' || r.key, r.scope, NULL, NULL,
       r.key, r.name, r."desc", r.rank,
       -- Geteilte Rollen sind nicht editierbar: eine Änderung träfe alle Mandanten.
       false, true
  FROM "Role" r
 WHERE r.system
 ORDER BY r.scope, r.key, r."workspaceId" NULLS FIRST
ON CONFLICT (id) DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionKey", "effect")
SELECT 'sys:' || src.scope || ':' || src.key, rp."permissionKey",
       (CASE WHEN bool_or(rp.effect = 'DENY') THEN 'DENY' ELSE 'ALLOW' END)::"PermissionEffect"
  FROM "Role" src
  JOIN "RolePermission" rp ON rp."roleId" = src.id
 WHERE src.system AND src.id NOT LIKE 'sys:%'
 GROUP BY 1, 2
ON CONFLICT ("roleId", "permissionKey") DO NOTHING;

-- Alle Zuweisungen auf die geteilte Zeile umbiegen.
UPDATE "WorkspaceMember" m SET "roleId" = 'sys:' || r.scope || ':' || r.key
  FROM "Role" r WHERE r.id = m."roleId" AND r.system AND r.id NOT LIKE 'sys:%';

UPDATE "ProjectMember" m SET "roleId" = 'sys:' || r.scope || ':' || r.key
  FROM "Role" r WHERE r.id = m."roleId" AND r.system AND r.id NOT LIKE 'sys:%';

UPDATE "User" u SET "platformRoleId" = 'sys:' || r.scope || ':' || r.key
  FROM "Role" r WHERE r.id = u."platformRoleId" AND r.system AND r.id NOT LIKE 'sys:%';

-- Die Kopien sind jetzt unbenutzt (RolePermission hängt per CASCADE mit dran).
DELETE FROM "Role" WHERE system AND id NOT LIKE 'sys:%';

-- ─── 5. Integrität: Eigentümer, Eindeutigkeit ────────────────────────────────

-- Welche Eigentümerspalten zu welcher Art von Rolle gehören, ist damit
-- erzwungen statt nur dokumentiert.
ALTER TABLE "Role" ADD CONSTRAINT "Role_owner_check" CHECK (
     (system      AND "workspaceId" IS NULL     AND "projectId" IS NULL)
  OR (NOT system AND scope = 'PLATFORM'  AND "workspaceId" IS NULL     AND "projectId" IS NULL)
  OR (NOT system AND scope = 'WORKSPACE' AND "workspaceId" IS NOT NULL AND "projectId" IS NULL)
  OR (NOT system AND scope = 'PROJECT'   AND "workspaceId" IS NOT NULL)
);

-- Partielle Unique-Indizes statt @@unique: Postgres hält zwei NULL-Werte für
-- verschieden, ein Unique-Key über die nullable Eigentümerspalten würde
-- Duplikate durchlassen.
CREATE UNIQUE INDEX "Role_system_key"   ON "Role" (scope, key)                  WHERE system;
CREATE UNIQUE INDEX "Role_platform_key" ON "Role" (key)                         WHERE NOT system AND scope = 'PLATFORM';
CREATE UNIQUE INDEX "Role_ws_key"       ON "Role" (scope, "workspaceId", key)   WHERE NOT system AND scope <> 'PLATFORM' AND "projectId" IS NULL;
CREATE UNIQUE INDEX "Role_proj_key"     ON "Role" (scope, "projectId", key)     WHERE NOT system AND "projectId" IS NOT NULL;

CREATE INDEX "Role_scope_workspaceId_idx" ON "Role" (scope, "workspaceId");

-- ─── 6. Fehlende System-Rollen anlegen ───────────────────────────────────────
--
-- Nach der Zusammenlegung existieren nur die Rollen, von denen es vorher schon
-- Kopien gab. Auf einer frischen Datenbank sind das nicht alle: die
-- Workspace-Rollen entstanden früher erst bei der Provisionierung eines
-- Workspace. `ON CONFLICT DO NOTHING` lässt vorhandene Zeilen unberührt.

INSERT INTO "Role" (id, scope, "workspaceId", "projectId", key, name, "desc", rank, editable, system) VALUES
  ('sys:PLATFORM:platform_admin', 'PLATFORM'::"RoleScope", NULL, NULL, 'platform_admin', 'Platform Admin', 'Verwaltet die Plattform: Benutzerkonten, Workspaces, globale Rollen. Kein Zugriff auf Inhalte der Workspaces.', 2, false, true),
  ('sys:PLATFORM:platform_support', 'PLATFORM'::"RoleScope", NULL, NULL, 'platform_support', 'Platform Support', 'Darf zur Fehlersuche in alle Workspaces sehen und dort handeln. Keine Verwaltung von Konten oder Rollen.', 1, false, true),
  ('sys:PLATFORM:platform_member', 'PLATFORM'::"RoleScope", NULL, NULL, 'platform_member', 'Platform Member', 'Normaler Benutzer ohne Plattform-Rechte. Standard für jedes neue Konto.', 0, false, true),
  ('sys:WORKSPACE:owner', 'WORKSPACE'::"RoleScope", NULL, NULL, 'owner', 'Owner', 'Workspace-Ersteller. Einziger mit dem Recht, den Workspace zu löschen.', 6, false, true),
  ('sys:WORKSPACE:admin', 'WORKSPACE'::"RoleScope", NULL, NULL, 'admin', 'Admin', 'Vollzugriff. Verwaltet Rollen und Berechtigungen, aber löscht den Workspace nicht.', 5, false, true),
  ('sys:WORKSPACE:manager', 'WORKSPACE'::"RoleScope", NULL, NULL, 'manager', 'Manager', 'Verwaltet Einstellungen, Mitglieder, Teams und Konfiguration. Keine Rollenverwaltung, kein Zugang zu privaten Projekten.', 4, false, true),
  ('sys:WORKSPACE:project_lead', 'WORKSPACE'::"RoleScope", NULL, NULL, 'project_lead', 'Project Lead', 'Voller Zugriff auf die Projekte des Workspace, inklusive deren Mitglieder. Keine Workspace-Verwaltung.', 3, false, true),
  ('sys:WORKSPACE:member', 'WORKSPACE'::"RoleScope", NULL, NULL, 'member', 'Member', 'Standardrolle. Erstellt Issues, bearbeitet die eigenen, kommentiert und legt Labels an.', 2, false, true),
  ('sys:WORKSPACE:viewer', 'WORKSPACE'::"RoleScope", NULL, NULL, 'viewer', 'Viewer', 'Lesezugriff auf den Workspace. Darf kommentieren, aber keine Issues erstellen.', 1, false, true),
  ('sys:WORKSPACE:guest', 'WORKSPACE'::"RoleScope", NULL, NULL, 'guest', 'Guest', 'Von außen hinzugekommen. Sieht nur, wozu er ausdrücklich eingeladen wurde.', 0, false, true),
  ('sys:PROJECT:project_admin', 'PROJECT'::"RoleScope", NULL, NULL, 'project_admin', 'Project Admin', 'Voller Zugriff auf dieses Projekt inklusive Einstellungen, Mitglieder und projekteigener Rollen.', 4, false, true),
  ('sys:PROJECT:contributor', 'PROJECT'::"RoleScope", NULL, NULL, 'contributor', 'Contributor', 'Arbeitet im Projekt mit: erstellt Issues, bearbeitet die eigenen, kommentiert.', 3, false, true),
  ('sys:PROJECT:project_viewer', 'PROJECT'::"RoleScope", NULL, NULL, 'project_viewer', 'Viewer', 'Liest mit und kommentiert. Alles Schreibende ist hier gesperrt — auch wenn die Workspace-Rolle mehr erlauben würde.', 2, false, true),
  ('sys:PROJECT:project_guest', 'PROJECT'::"RoleScope", NULL, NULL, 'project_guest', 'Guest', 'Von außen zu genau diesem Projekt eingeladen. Rechte wie ein Viewer, ohne Workspace-Mitgliedschaft.', 1, false, true),
  ('sys:PROJECT:blocked', 'PROJECT'::"RoleScope", NULL, NULL, 'blocked', 'Blocked', 'Ausdrücklicher Ausschluss. Sperrt dieses Projekt auch für Mitglieder, die es über ihre Workspace-Rolle sehen dürften.', 0, false, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionKey", "effect") VALUES
  ('sys:PLATFORM:platform_admin', 'platform.access', 'ALLOW'::"PermissionEffect"),
  ('sys:PLATFORM:platform_admin', 'user.manage', 'ALLOW'::"PermissionEffect"),
  ('sys:PLATFORM:platform_admin', 'workspace.suspend', 'ALLOW'::"PermissionEffect"),
  ('sys:PLATFORM:platform_admin', 'workspace.delete', 'ALLOW'::"PermissionEffect"),
  ('sys:PLATFORM:platform_admin', 'role.manage', 'ALLOW'::"PermissionEffect"),
  ('sys:PLATFORM:platform_support', 'platform.access', 'ALLOW'::"PermissionEffect"),
  ('sys:PLATFORM:platform_support', 'tenant.access', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'workspace.update', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'workspace.delete', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'config.manage', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'audit.view', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'role.manage', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'member.invite', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'member.remove', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'member.role.update', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'project.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'project.view', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'project.view.all', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'project.update', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'project.delete', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'team.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'team.update', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'team.delete', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'team.member.manage', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'team.project.manage', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'label.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'label.update', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'label.delete', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'issue.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'issue.update.any', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'issue.update.own', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'issue.delete.any', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'issue.delete.own', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'issue.assign', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'comment.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'comment.delete.any', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:owner', 'comment.delete.own', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'workspace.update', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'config.manage', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'audit.view', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'role.manage', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'member.invite', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'member.remove', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'member.role.update', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'project.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'project.view', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'project.view.all', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'project.update', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'project.delete', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'team.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'team.update', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'team.delete', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'team.member.manage', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'team.project.manage', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'label.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'label.update', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'label.delete', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'issue.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'issue.update.any', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'issue.update.own', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'issue.delete.any', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'issue.delete.own', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'issue.assign', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'comment.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'comment.delete.any', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:admin', 'comment.delete.own', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'workspace.update', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'config.manage', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'audit.view', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'member.invite', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'member.remove', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'member.role.update', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'project.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'project.view', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'project.update', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'project.delete', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'team.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'team.update', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'team.delete', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'team.member.manage', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'team.project.manage', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'label.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'label.update', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'label.delete', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'issue.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'issue.update.any', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'issue.update.own', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'issue.delete.any', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'issue.delete.own', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'issue.assign', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'comment.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'comment.delete.any', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:manager', 'comment.delete.own', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:project_lead', 'project.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:project_lead', 'project.view', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:project_lead', 'project.update', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:project_lead', 'project.delete', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:project_lead', 'member.invite', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:project_lead', 'member.remove', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:project_lead', 'member.role.update', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:project_lead', 'label.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:project_lead', 'label.update', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:project_lead', 'label.delete', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:project_lead', 'issue.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:project_lead', 'issue.update.any', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:project_lead', 'issue.update.own', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:project_lead', 'issue.delete.any', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:project_lead', 'issue.delete.own', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:project_lead', 'issue.assign', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:project_lead', 'comment.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:project_lead', 'comment.delete.any', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:project_lead', 'comment.delete.own', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:member', 'project.view', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:member', 'issue.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:member', 'issue.update.own', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:member', 'issue.delete.own', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:member', 'issue.assign', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:member', 'comment.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:member', 'comment.delete.own', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:member', 'label.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:member', 'label.update', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:viewer', 'project.view', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:viewer', 'comment.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:viewer', 'comment.delete.own', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:guest', 'project.view', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:guest', 'comment.create', 'ALLOW'::"PermissionEffect"),
  ('sys:WORKSPACE:guest', 'comment.delete.own', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_admin', 'role.manage', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_admin', 'member.invite', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_admin', 'member.remove', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_admin', 'member.role.update', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_admin', 'project.view', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_admin', 'project.update', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_admin', 'project.delete', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_admin', 'label.create', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_admin', 'label.update', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_admin', 'label.delete', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_admin', 'issue.create', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_admin', 'issue.update.any', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_admin', 'issue.update.own', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_admin', 'issue.delete.any', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_admin', 'issue.delete.own', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_admin', 'issue.assign', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_admin', 'comment.create', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_admin', 'comment.delete.any', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_admin', 'comment.delete.own', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:contributor', 'project.view', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:contributor', 'issue.create', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:contributor', 'issue.update.own', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:contributor', 'issue.delete.own', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:contributor', 'issue.assign', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:contributor', 'comment.create', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:contributor', 'comment.delete.own', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:contributor', 'label.create', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:contributor', 'label.update', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_viewer', 'project.view', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_viewer', 'comment.create', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_viewer', 'comment.delete.own', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_viewer', 'role.manage', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_viewer', 'member.invite', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_viewer', 'member.remove', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_viewer', 'member.role.update', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_viewer', 'project.update', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_viewer', 'project.delete', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_viewer', 'label.create', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_viewer', 'label.update', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_viewer', 'label.delete', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_viewer', 'issue.create', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_viewer', 'issue.update.any', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_viewer', 'issue.update.own', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_viewer', 'issue.delete.any', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_viewer', 'issue.delete.own', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_viewer', 'issue.assign', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_viewer', 'comment.delete.any', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_guest', 'project.view', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_guest', 'comment.create', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_guest', 'comment.delete.own', 'ALLOW'::"PermissionEffect"),
  ('sys:PROJECT:project_guest', 'role.manage', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_guest', 'member.invite', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_guest', 'member.remove', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_guest', 'member.role.update', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_guest', 'project.update', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_guest', 'project.delete', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_guest', 'label.create', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_guest', 'label.update', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_guest', 'label.delete', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_guest', 'issue.create', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_guest', 'issue.update.any', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_guest', 'issue.update.own', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_guest', 'issue.delete.any', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_guest', 'issue.delete.own', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_guest', 'issue.assign', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:project_guest', 'comment.delete.any', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:blocked', 'role.manage', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:blocked', 'member.invite', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:blocked', 'member.remove', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:blocked', 'member.role.update', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:blocked', 'project.view', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:blocked', 'project.update', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:blocked', 'project.delete', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:blocked', 'label.create', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:blocked', 'label.update', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:blocked', 'label.delete', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:blocked', 'issue.create', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:blocked', 'issue.update.any', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:blocked', 'issue.update.own', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:blocked', 'issue.delete.any', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:blocked', 'issue.delete.own', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:blocked', 'issue.assign', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:blocked', 'comment.create', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:blocked', 'comment.delete.any', 'DENY'::"PermissionEffect"),
  ('sys:PROJECT:blocked', 'comment.delete.own', 'DENY'::"PermissionEffect")
ON CONFLICT ("roleId", "permissionKey") DO NOTHING;
