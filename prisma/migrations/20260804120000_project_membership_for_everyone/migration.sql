-- Projektrolle für jeden, der im Projekt ist
--
-- Vorher stand in `ProjectMember` nur, wer eine vom Workspace abweichende Rolle
-- brauchte. Alle anderen — der Ersteller des Workspace eingeschlossen — kamen in
-- der Tabelle gar nicht vor; ihre Rechte im Projekt kamen aus `WorkspaceMember`.
--
-- Danach hat jeder eine eigene Projektrolle, und die entscheidet im Projekt
-- (siehe lib/permissions.ts): Projekt-Ebene → `ProjectMember`, Workspace-Ebene →
-- `WorkspaceMember`. Diese Migration legt die fehlenden Zeilen an. Am Schema
-- ändert sich nichts.
--
-- Die Rolle wird aus den Rechten der Workspace-Rolle abgeleitet, damit niemand
-- durch das Nachtragen mehr oder weniger darf als vorher. Dieselbe Ableitung
-- steht in lib/project-membership.ts (`projectRoleKeyFor`) — wer sie hier ändert,
-- ändert sie auch dort.
--
-- Nur öffentliche Projekte: in ein privates kommt weiterhin ausschließlich, wer
-- ausdrücklich aufgenommen wurde — und der hat schon eine Zeile.

WITH granted AS (
  -- Effektive Rechte je Workspace-Mitglied: ALLOW abzüglich DENY.
  SELECT wm."workspaceId", wm."userId", rp."permissionKey"
  FROM "WorkspaceMember" wm
  JOIN "RolePermission" rp
    ON rp."roleId" = wm."roleId" AND rp."effect" = 'ALLOW'
  WHERE NOT EXISTS (
    SELECT 1 FROM "RolePermission" d
    WHERE d."roleId" = wm."roleId"
      AND d."permissionKey" = rp."permissionKey"
      AND d."effect" = 'DENY'
  )
),
mapped AS (
  SELECT
    wm."workspaceId",
    wm."userId",
    'sys:PROJECT:' || CASE
      -- Verwaltet Projektmitglieder oder sieht ohnehin jedes Projekt.
      WHEN EXISTS (
        SELECT 1 FROM granted g
        WHERE g."workspaceId" = wm."workspaceId" AND g."userId" = wm."userId"
          AND g."permissionKey" IN ('member.invite', 'project.view.all')
      ) THEN 'project_admin'
      -- Arbeitet mit.
      WHEN EXISTS (
        SELECT 1 FROM granted g
        WHERE g."workspaceId" = wm."workspaceId" AND g."userId" = wm."userId"
          AND g."permissionKey" = 'issue.create'
      ) THEN 'contributor'
      -- Liest mit.
      WHEN EXISTS (
        SELECT 1 FROM granted g
        WHERE g."workspaceId" = wm."workspaceId" AND g."userId" = wm."userId"
          AND g."permissionKey" = 'project.view'
      ) THEN 'project_viewer'
      -- Durfte auch vorher kein Projekt sehen.
      ELSE 'blocked'
    END AS "roleId"
  FROM "WorkspaceMember" wm
)
INSERT INTO "ProjectMember" ("projectId", "userId", "roleId")
SELECT p."id", m."userId", m."roleId"
FROM mapped m
JOIN "Project" p ON p."workspaceId" = m."workspaceId"
WHERE p."visibility" = 'public'
ON CONFLICT ("projectId", "userId") DO NOTHING;
