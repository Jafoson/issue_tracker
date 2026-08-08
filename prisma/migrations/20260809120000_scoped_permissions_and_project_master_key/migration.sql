-- ─── Ebenen strikt trennen, Generalschlüssel einführen ────────────────────────
--
-- Bis hierher konnte eine Workspace-Rolle projektbezogene Rechte tragen, die in
-- allen Projekten galten, in denen jemand keine eigene Projektrolle hatte. Der
-- Resolver hat sie beim Betreten eines Projekts wieder herausgefiltert — die
-- Trennung war Laufzeitlogik.
--
-- Ab jetzt löst jeder Kontext genau eine Rolle auf: im Projekt die Projektrolle,
-- im Workspace die Workspace-Rolle, auf der Plattform die Plattform-Rolle. Damit
-- die Leitung eines Workspace trotzdem in ihren Projekten handlungsfähig bleibt,
-- gibt es `project.admin.all` — den Generalschlüssel, der vor der Projektrolle
-- geprüft wird und deshalb von keiner Projektrolle ausgehebelt werden kann.
--
-- Drei Schritte: Schlüssel anlegen, Schlüssel an die bisherigen Berechtigten
-- vergeben, wirkungslos gewordene Zeilen entfernen.

-- ─── 1. Die neue Permission ───────────────────────────────────────────────────

INSERT INTO "Permission" ("key", "desc")
VALUES (
  'project.admin.all',
  'In jedem Projekt des Workspace alle Rechte haben, ohne Mitglied zu sein'
)
ON CONFLICT ("key") DO NOTHING;

-- ─── 2. Den Generalschlüssel vergeben ─────────────────────────────────────────
--
-- Alle Einfügungen lesen aus "Role" statt feste Werte zu schreiben. Auf einer
-- frischen Datenbank läuft `migrate deploy` vor dem Seed, die System-Rollen gibt
-- es dann noch gar nicht — ein Literal liefe in eine Fremdschlüsselverletzung,
-- ein SELECT trifft einfach keine Zeile. Der Seed legt sie danach vollständig an.

-- 2a. Wer bisher `project.view.all` hatte, behielt im Projekt seine komplette
--     Workspace-Rechtemenge (die alte Regel `keepsProjectRights`). Genau diese
--     Gruppe bekommt jetzt den Schlüssel, der das ausdrücklich sagt — die
--     System-Rollen `owner` und `admin` ebenso wie selbst angelegte Rollen.
--     Ohne diesen Schritt verlöre ein Owner den Zugriff auf seine Projekte.
INSERT INTO "RolePermission" ("roleId", "permissionKey", "effect")
SELECT rp."roleId", 'project.admin.all', 'ALLOW'
FROM "RolePermission" rp
JOIN "Role" r ON r."id" = rp."roleId"
WHERE r."scope" = 'WORKSPACE'
  AND rp."permissionKey" = 'project.view.all'
  AND rp."effect" = 'ALLOW'
ON CONFLICT ("roleId", "permissionKey") DO NOTHING;

-- 2b. `project_lead` ist der Sonderfall: die Rolle hatte nie `project.view.all`,
--     sondern trug die Projektrechte einzeln. Diesen Weg gibt es nicht mehr —
--     ihr Zweck („voller Zugriff auf alle Projekte") heißt jetzt genau so.
INSERT INTO "RolePermission" ("roleId", "permissionKey", "effect")
SELECT r."id", k."key", 'ALLOW'
FROM "Role" r
CROSS JOIN (VALUES ('project.view.all'), ('project.admin.all')) AS k("key")
WHERE r."id" = 'sys:WORKSPACE:project_lead'
ON CONFLICT ("roleId", "permissionKey") DO NOTHING;

-- ─── 3. Wirkungslos gewordene Zeilen entfernen ────────────────────────────────
--
-- `collect()` übergeht diese Einträge ohnehin (Scope-Filter). Sie stehen zu
-- lassen wäre trotzdem falsch: die Rollen-Matrix zeigt nur, was der Scope
-- zulässt, also wären sie unsichtbar und über die Oberfläche nicht mehr zu
-- entfernen. Verborgener Zustand in einer Rechtetabelle ist das Letzte, was man
-- haben will.

-- 3a. Rein projektbezogene Rechte in Workspace-Rollen. Die Ebene, für die sie
--     gedacht waren, hat ihre eigenen Rollen — die Zeilen in `ProjectMember`
--     tragen sie seit `20260804120000_project_membership_for_everyone`.
DELETE FROM "RolePermission" rp
USING "Role" r
WHERE r."id" = rp."roleId"
  AND r."scope" = 'WORKSPACE'
  AND rp."permissionKey" IN (
    'project.view', 'project.update', 'project.delete',
    'issue.create', 'issue.update.any', 'issue.update.own',
    'issue.delete.any', 'issue.delete.own', 'issue.assign',
    'comment.create', 'comment.delete.any', 'comment.delete.own'
  );

-- 3b. Die erschöpfenden DENY-Listen der restriktiven Projektrollen. Sie waren
--     nötig, solange Rechte von oben durchsickerten und dort verboten werden
--     mussten. Jetzt kommt von oben nichts mehr — die leere ALLOW-Liste genügt,
--     und das DENY würde nur noch den Generalschlüssel scheinbar angreifen.
DELETE FROM "RolePermission" rp
USING "Role" r
WHERE r."id" = rp."roleId"
  AND r."scope" = 'PROJECT'
  AND r."system" = true
  AND r."key" IN ('project_viewer', 'project_guest', 'blocked')
  AND rp."effect" = 'DENY';
