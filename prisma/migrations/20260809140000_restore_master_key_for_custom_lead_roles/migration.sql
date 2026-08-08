-- ─── Nachtrag: Generalschlüssel für eigene Leitungsrollen ─────────────────────
--
-- Die Migration `20260809120000_scoped_permissions_and_project_master_key` hat
-- die Projektrechte aus allen Workspace-Rollen entfernt und den Verlust nur dort
-- ausgeglichen, wo `project.view.all` stand. Das griff für die System-Rollen
-- (`owner`, `admin`, und `project_lead` als ausdrücklicher Sonderfall) — aber
-- nicht für **selbst angelegte** Rollen, die ihre Projektrechte einzeln trugen,
-- so wie `project_lead` es tat.
--
-- Eine solche Rolle steht seitdem ohne jeden Zugriff auf die Projekte ihres
-- Workspace da. Betrifft in der Praxis Owner- und Admin-Klone: wer sich eine
-- eigene Leitungsrolle gebaut hat, statt die geteilte zu nehmen, verlor genau
-- die Zusage, für die es den Generalschlüssel gibt — die Leitung eines Workspace
-- lässt sich aus keinem seiner Projekte aussperren.
--
-- Erkannt werden solche Rollen an zwei Rechten, die zusammen nur die Leitung
-- hat: `workspace.update` (den Workspace selbst ändern) und `role.manage`
-- (Rollen definieren). Das ist enger als „irgendein Projektrecht" und trifft
-- keine Fach- oder Gastrolle.
--
-- Auf einer frischen Datenbank ist das ein No-op: eigene Rollen gibt es dort
-- noch nicht, der Seed legt nur die System-Rollen an.
--
-- Die Rechte werden bewusst NUR ergänzt. Wer den Durchgriff nicht will, nimmt
-- ihn in der Rollen-Matrix wieder heraus — das ist eine sichtbare Entscheidung
-- und keine, die eine Migration im Vorbeigehen trifft.

INSERT INTO "RolePermission" ("roleId", "permissionKey", "effect")
SELECT r."id", k."key", 'ALLOW'
FROM "Role" r
CROSS JOIN (VALUES ('project.view.all'), ('project.admin.all')) AS k("key")
WHERE r."scope" = 'WORKSPACE'
  AND r."system" = false
  AND EXISTS (
    SELECT 1 FROM "RolePermission" rp
    WHERE rp."roleId" = r."id"
      AND rp."permissionKey" = 'workspace.update'
      AND rp."effect" = 'ALLOW'
  )
  AND EXISTS (
    SELECT 1 FROM "RolePermission" rp
    WHERE rp."roleId" = r."id"
      AND rp."permissionKey" = 'role.manage'
      AND rp."effect" = 'ALLOW'
  )
ON CONFLICT ("roleId", "permissionKey") DO NOTHING;
