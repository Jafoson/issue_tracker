-- ─── DENY entfernen ───────────────────────────────────────────────────────────
--
-- `RolePermission.effect` konnte ALLOW oder DENY sein. Das hatte einen Sinn,
-- solange eine Prüfung mehrere Rollen vereinigte: ein DENY war das einzige
-- Mittel, ein von der Ebene darüber durchgereichtes Recht wieder wegzunehmen.
--
-- Mit `20260809120000_scoped_permissions_and_project_master_key` löst jeder
-- Kontext genau eine Rolle auf. Zusammen mit dem Primärschlüssel
-- (roleId, permissionKey) — eine Rolle hält pro Permission höchstens eine Zeile —
-- folgt daraus: ALLOW und DENY derselben Permission können in einer Auflösung nie
-- zusammentreffen. Ein DENY war von „keine Zeile" nicht mehr zu unterscheiden.
--
-- Es blieb also ein Verbotsschild, das nichts verbietet, und die Rollen-Matrix
-- bot es als eigene Stufe an. In einer Rechtetabelle ist das schlechter als gar
-- nichts: man setzt es, sieht ein Symbol und hält etwas für durchgesetzt.
--
-- Eine Zeile heißt ab jetzt schlicht: diese Rolle hat diese Permission.

-- Bestehende DENY-Zeilen fallen weg. Sie haben zuletzt nichts mehr bewirkt —
-- sie zu ALLOW zu machen wäre das Gegenteil dessen, was jemand gemeint hat,
-- als er sie setzte.
DELETE FROM "RolePermission" WHERE "effect" = 'DENY';

ALTER TABLE "RolePermission" DROP COLUMN "effect";

DROP TYPE "PermissionEffect";
