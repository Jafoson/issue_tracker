-- Dreistufiges RBAC: GLOBAL · WORKSPACE · PROJECT
--
-- Vorher gab es Rollen nur auf der Workspace-Ebene. `User.globalRole` war ein
-- nackter String ohne Permissions, und `ProjectMember.role` zeigte auf eine
-- Workspace-Rolle. Danach gibt es echte Rollen auf allen drei Ebenen, und die
-- Auswertung ist eine Vereinigung über alle Ebenen, bei der ein DENY sticht.
--
-- Die Backfill-Schritte sind von Hand ergänzt: Prisma erzeugt für NOT-NULL-
-- Spalten ohne Default kein gültiges SQL für bestehende Zeilen.

-- ─── 1. Enums ────────────────────────────────────────────────────────────────

CREATE TYPE "RoleLevel" AS ENUM ('GLOBAL', 'WORKSPACE', 'PROJECT');
CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');

-- ─── 2. Permission: neue Keys, Ebene aus dem Präfix ──────────────────────────

ALTER TABLE "Permission" ADD COLUMN "level" "RoleLevel";

-- Die vollständige Registry, nicht nur die neuen Keys: die Tabelle ist
-- FK-Ziel für RolePermission, und die Einfügungen weiter unten setzen jeden
-- Key voraus. Auf einer frischen Datenbank stünde hier sonst fast nichts —
-- eine frühere Migration legt bereits einen Workspace an, dessen Rollen dann
-- ins Leere zeigen würden.
INSERT INTO "Permission" ("key", "desc") VALUES
  ('platform.admin.access', 'Zugang zum Plattform-Bereich (/admin)'),
  ('platform.user.manage', 'Benutzerkonten plattformweit verwalten'),
  ('platform.workspace.suspend', 'Workspaces sperren und entsperren'),
  ('platform.workspace.delete', 'Workspaces plattformweit löschen'),
  ('platform.role.manage', 'Globale Rollen definieren und Permissions zuweisen'),
  ('platform.workspace.access', 'Inhalte fremder Workspaces einsehen und bearbeiten (Support-Zugriff)'),
  ('workspace.settings.update', 'Name, Farbe, Slug des Workspace ändern'),
  ('workspace.delete', 'Workspace unwiderruflich löschen'),
  ('workspace.role.manage', 'Workspace- und Projektrollen definieren und Permissions zuweisen'),
  ('workspace.config.manage', 'Status, Prioritäten, Issue-Typen workspace-weit verwalten'),
  ('workspace.audit.view', 'Audit-Log einsehen'),
  ('workspace.member.invite', 'Einladungen an neue Mitglieder versenden'),
  ('workspace.member.remove', 'Mitglieder aus dem Workspace entfernen'),
  ('workspace.member.role.update', 'Rolle eines anderen Mitglieds ändern'),
  ('workspace.project.create', 'Neues Projekt im Workspace anlegen'),
  ('workspace.project.view.all', 'Alle Projekte des Workspace sehen, auch private ohne Mitgliedschaft'),
  ('workspace.team.create', 'Team erstellen'),
  ('workspace.team.update', 'Team-Name, Farbe und Lead ändern'),
  ('workspace.team.delete', 'Team löschen'),
  ('workspace.team.member.manage', 'Mitglieder zu Teams hinzufügen oder entfernen'),
  ('workspace.team.project.manage', 'Projekte Teams zuordnen oder entfernen'),
  ('workspace.label.create', 'Workspace-weites Label anlegen'),
  ('workspace.label.update', 'Workspace-Label bearbeiten'),
  ('workspace.label.delete', 'Workspace-Label löschen'),
  ('project.view', 'Projekt sehen (relevant für private Projekte)'),
  ('project.settings.update', 'Projektname, Präfix und Farbe ändern'),
  ('project.delete', 'Projekt löschen'),
  ('project.member.manage', 'Projekt-spezifische Rollen vergeben (inkl. Guests)'),
  ('project.role.manage', 'Projektlokale Rollen definieren'),
  ('project.issue.create', 'Issue im Projekt erstellen'),
  ('project.issue.update.any', 'Beliebige Issues bearbeiten'),
  ('project.issue.update.own', 'Nur eigene Issues bearbeiten (Reporter oder Assignee)'),
  ('project.issue.delete.any', 'Beliebige Issues löschen'),
  ('project.issue.delete.own', 'Nur eigene Issues löschen'),
  ('project.issue.assign', 'Issues anderen Mitgliedern zuweisen'),
  ('project.comment.create', 'Kommentar zu einem Issue schreiben'),
  ('project.comment.delete.any', 'Beliebige Kommentare löschen'),
  ('project.comment.delete.own', 'Nur eigene Kommentare löschen'),
  ('project.label.create', 'Projekt-spezifisches Label anlegen'),
  ('project.label.update', 'Projekt-Label bearbeiten'),
  ('project.label.delete', 'Projekt-Label löschen')
ON CONFLICT ("key") DO NOTHING;

UPDATE "Permission" SET "level" = CASE
  WHEN "key" LIKE 'platform.%'  THEN 'GLOBAL'::"RoleLevel"
  WHEN "key" LIKE 'workspace.%' THEN 'WORKSPACE'::"RoleLevel"
  ELSE 'PROJECT'::"RoleLevel"
END;

ALTER TABLE "Permission" ALTER COLUMN "level" SET NOT NULL;

-- ─── 3. Role: Ebene, Projektbezug, neues Id-Schema ───────────────────────────

DROP INDEX "Role_workspaceId_key_key";
DROP INDEX "Role_workspaceId_idx";

ALTER TABLE "Role"
  ADD COLUMN "level"     "RoleLevel",
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "system"    BOOLEAN NOT NULL DEFAULT false,
  ALTER COLUMN "workspaceId" DROP NOT NULL;

-- Alle bestehenden Rollen sind Workspace-Rollen und stammen aus der Provisionierung.
UPDATE "Role" SET "level" = 'WORKSPACE', "system" = true;
ALTER TABLE "Role" ALTER COLUMN "level" SET NOT NULL;

-- Ids auf das neue, ebenen-eindeutige Schema heben (siehe lib/rbac/id.ts).
-- Kaskadiert dank ON UPDATE CASCADE auf RolePermission."roleId".
UPDATE "Role"
   SET "id" = 'ws:' || "workspaceId" || ':' || "key"
 WHERE "level" = 'WORKSPACE';

-- ─── 4. RolePermission: ALLOW/DENY ───────────────────────────────────────────

ALTER TABLE "RolePermission"
  ADD COLUMN "effect" "PermissionEffect" NOT NULL DEFAULT 'ALLOW';

-- ─── 5. Neue Permissions an die bestehenden Workspace-Rollen ─────────────────
--
-- `workspace.project.view.all` ersetzt den bisher hart kodierten Vollzugriff von
-- Owner und Admin auf private Projekte.

INSERT INTO "RolePermission" ("roleId", "permissionKey", "effect")
SELECT "id", 'workspace.project.view.all', 'ALLOW'
  FROM "Role"
 WHERE "level" = 'WORKSPACE' AND "key" IN ('owner', 'admin');

-- Wer ohnehin alle project.*-Rechte hat, verwaltet auch projektlokale Rollen.
INSERT INTO "RolePermission" ("roleId", "permissionKey", "effect")
SELECT "id", 'project.role.manage', 'ALLOW'
  FROM "Role"
 WHERE "level" = 'WORKSPACE'
   AND "key" IN ('owner', 'admin', 'manager', 'project_lead');

-- ─── 6. Globale Rollen ───────────────────────────────────────────────────────
--
-- `platform_admin` bekommt bewusst NICHT `platform.workspace.access`: der
-- Zugriff auf Tenant-Inhalte ist eine eigene, sichtbare Eskalation.

INSERT INTO "Role" ("id", "level", "workspaceId", "projectId", "key", "name", "desc", "rank", "editable", "system") VALUES
  ('global:platform_admin',   'GLOBAL', NULL, NULL, 'platform_admin',   'Platform Admin',   'Verwaltet die Plattform: Benutzerkonten, Workspaces, globale Rollen. Kein Zugriff auf Inhalte fremder Workspaces.', 2, true,  true),
  ('global:platform_support', 'GLOBAL', NULL, NULL, 'platform_support', 'Platform Support', 'Darf zur Fehlersuche in fremde Workspaces sehen. Keine Verwaltung von Konten oder Rollen.',                        1, true,  true),
  ('global:platform_member',  'GLOBAL', NULL, NULL, 'platform_member',  'Platform Member',  'Normaler Benutzer ohne Plattform-Rechte. Standard für jedes neue Konto.',                                          0, false, true);

INSERT INTO "RolePermission" ("roleId", "permissionKey", "effect")
SELECT 'global:platform_admin', "key", 'ALLOW'
  FROM "Permission"
 WHERE "level" = 'GLOBAL' AND "key" <> 'platform.workspace.access';

INSERT INTO "RolePermission" ("roleId", "permissionKey", "effect") VALUES
  ('global:platform_support', 'platform.admin.access',     'ALLOW'),
  ('global:platform_support', 'platform.workspace.access', 'ALLOW');

-- ─── 7. Projektrollen je Workspace ───────────────────────────────────────────
--
-- Gehören dem Workspace (projectId IS NULL) und sind damit in allen seinen
-- Projekten zuweisbar. Einzelne Projekte können später eigene ergänzen.

INSERT INTO "Role" ("id", "level", "workspaceId", "projectId", "key", "name", "desc", "rank", "editable", "system")
SELECT 'wsp:' || w."id" || ':' || r.key, 'PROJECT', w."id", NULL, r.key, r.name, r."desc", r.rank, r.editable, true
  FROM "Workspace" w
 CROSS JOIN (VALUES
   ('project_admin',  'Project Admin', 'Vollzugriff auf dieses Projekt inklusive Einstellungen, Mitgliedern und projektlokalen Rollen.',                                         4, true),
   ('contributor',    'Contributor',   'Arbeitet im Projekt mit: erstellt Issues, bearbeitet die eigenen, kommentiert.',                                                        3, true),
   ('project_viewer', 'Viewer',        'Liest mit und kommentiert. Alles Schreibende ist in diesem Projekt gesperrt — auch wenn die Workspace-Rolle mehr erlauben würde.',       2, true),
   ('project_guest',  'Guest',         'Von außen zu genau diesem Projekt eingeladen. Rechte wie ein Viewer, aber ohne Workspace-Mitgliedschaft.',                               1, true),
   ('blocked',        'Blocked',       'Ausdrücklicher Ausschluss. Sperrt dieses Projekt auch für Mitglieder, die es über ihre Workspace-Rolle sehen dürften.',                  0, false)
 ) AS r(key, name, "desc", rank, editable);

-- project_admin: alle Projekt-Permissions.
INSERT INTO "RolePermission" ("roleId", "permissionKey", "effect")
SELECT 'wsp:' || w."id" || ':project_admin', p."key", 'ALLOW'
  FROM "Workspace" w CROSS JOIN "Permission" p
 WHERE p."level" = 'PROJECT';

-- contributor: mitarbeiten, aber nur das Eigene ändern.
INSERT INTO "RolePermission" ("roleId", "permissionKey", "effect")
SELECT 'wsp:' || w."id" || ':contributor', t.k, 'ALLOW'
  FROM "Workspace" w
 CROSS JOIN (VALUES
   ('project.view'), ('project.issue.create'), ('project.issue.update.own'),
   ('project.issue.delete.own'), ('project.issue.assign'),
   ('project.comment.create'), ('project.comment.delete.own'),
   ('project.label.create'), ('project.label.update')
 ) AS t(k);

-- project_viewer und project_guest: lesen und kommentieren, alles andere
-- ausdrücklich verboten. Ohne diese DENY-Einträge behielte jemand mit einer
-- großzügigen Workspace-Rolle hier vollen Zugriff — die Vereinigung nimmt
-- nichts weg, nur ein DENY tut das.
INSERT INTO "RolePermission" ("roleId", "permissionKey", "effect")
SELECT 'wsp:' || w."id" || ':' || r.rk, p."key",
       CASE WHEN p."key" IN ('project.view', 'project.comment.create', 'project.comment.delete.own')
            THEN 'ALLOW'::"PermissionEffect"
            ELSE 'DENY'::"PermissionEffect"
       END
  FROM "Workspace" w
 CROSS JOIN (VALUES ('project_viewer'), ('project_guest')) AS r(rk)
 CROSS JOIN "Permission" p
 WHERE p."level" = 'PROJECT';

-- blocked: nimmt jeden Projektzugriff, egal woher er käme.
INSERT INTO "RolePermission" ("roleId", "permissionKey", "effect")
SELECT 'wsp:' || w."id" || ':blocked', p."key", 'DENY'
  FROM "Workspace" w CROSS JOIN "Permission" p
 WHERE p."level" = 'PROJECT';

-- ─── 8. User.globalRole → globalRoleId ───────────────────────────────────────

ALTER TABLE "User" ADD COLUMN "globalRoleId" TEXT;

UPDATE "User"
   SET "globalRoleId" = CASE WHEN "globalRole" = 'admin'
                             THEN 'global:platform_admin'
                             ELSE 'global:platform_member'
                        END;

-- ─── 9. WorkspaceMember.role → roleId ────────────────────────────────────────

ALTER TABLE "WorkspaceMember" ADD COLUMN "roleId" TEXT;

UPDATE "WorkspaceMember" SET "roleId" = 'ws:' || "workspaceId" || ':' || "role";

-- Sicherheitsnetz für Rollen-Strings, zu denen keine Role-Zeile existiert:
-- lieber auf die Standardrolle zurückfallen als die Migration abbrechen.
UPDATE "WorkspaceMember" m
   SET "roleId" = 'ws:' || m."workspaceId" || ':member'
 WHERE NOT EXISTS (SELECT 1 FROM "Role" r WHERE r."id" = m."roleId");

ALTER TABLE "WorkspaceMember" ALTER COLUMN "roleId" SET NOT NULL;

-- ─── 10. ProjectMember.role → roleId ─────────────────────────────────────────
--
-- Der alte Wert war ein Workspace-Rollen-Key und ersetzte die Workspace-Rolle.
-- Jetzt zeigt er auf eine Projektrolle und kommt zur Workspace-Rolle hinzu.
-- `viewer` und `guest` bilden ihre Herabstufung über DENY ab, bleiben also
-- wirksam; die verwaltenden Rollen waren ohnehin additiv.

ALTER TABLE "ProjectMember" ADD COLUMN "roleId" TEXT;

UPDATE "ProjectMember" pm
   SET "roleId" = 'wsp:' || pr."workspaceId" || ':' || CASE pm."role"
         WHEN 'owner'        THEN 'project_admin'
         WHEN 'admin'        THEN 'project_admin'
         WHEN 'manager'      THEN 'project_admin'
         WHEN 'project_lead' THEN 'project_admin'
         WHEN 'member'       THEN 'contributor'
         WHEN 'viewer'       THEN 'project_viewer'
         WHEN 'guest'        THEN 'project_guest'
         ELSE 'contributor'
       END
  FROM "Project" pr
 WHERE pr."id" = pm."projectId";

ALTER TABLE "ProjectMember" ALTER COLUMN "roleId" SET NOT NULL;

-- ─── 11. Integrität: Geltungsbereich, Eindeutigkeit, Fremdschlüssel ──────────

-- Welche Geltungsspalten zu welcher Ebene gehören, ist damit erzwungen statt
-- nur dokumentiert.
ALTER TABLE "Role" ADD CONSTRAINT "Role_scope_check" CHECK (
  ("level" = 'GLOBAL'    AND "workspaceId" IS NULL     AND "projectId" IS NULL) OR
  ("level" = 'WORKSPACE' AND "workspaceId" IS NOT NULL AND "projectId" IS NULL) OR
  ("level" = 'PROJECT'   AND "workspaceId" IS NOT NULL)
);

-- Partielle Unique-Indizes statt @@unique: Postgres hält zwei NULL-Werte für
-- verschieden, ein zusammengesetzter Unique-Key über die nullable
-- Geltungsspalten würde Duplikate durchlassen.
CREATE UNIQUE INDEX "Role_global_key"    ON "Role"("key")                 WHERE "level" = 'GLOBAL';
CREATE UNIQUE INDEX "Role_ws_key"        ON "Role"("workspaceId", "key")  WHERE "level" = 'WORKSPACE';
CREATE UNIQUE INDEX "Role_ws_proj_key"   ON "Role"("workspaceId", "key")  WHERE "level" = 'PROJECT' AND "projectId" IS NULL;
CREATE UNIQUE INDEX "Role_proj_key"      ON "Role"("projectId", "key")    WHERE "projectId" IS NOT NULL;

CREATE INDEX "Role_level_workspaceId_idx"  ON "Role"("level", "workspaceId");
CREATE INDEX "Role_projectId_idx"          ON "Role"("projectId");
CREATE INDEX "WorkspaceMember_roleId_idx"  ON "WorkspaceMember"("roleId");
CREATE INDEX "ProjectMember_roleId_idx"    ON "ProjectMember"("roleId");

ALTER TABLE "Role"
  ADD CONSTRAINT "Role_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User"
  ADD CONSTRAINT "User_globalRoleId_fkey"
  FOREIGN KEY ("globalRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMember"
  ADD CONSTRAINT "WorkspaceMember_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectMember"
  ADD CONSTRAINT "ProjectMember_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── 12. Alte Spalten entfernen ──────────────────────────────────────────────

ALTER TABLE "User"            DROP COLUMN "globalRole";
ALTER TABLE "WorkspaceMember" DROP COLUMN "role";
ALTER TABLE "ProjectMember"   DROP COLUMN "role";
