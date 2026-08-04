-- ─── 1. Project.visibility wird ein Enum ──────────────────────────────────────
--
-- Die Spalte hielt bisher einen Freitext mit der Union nur im Kommentar
-- (`"public" | "private"`). Ein Enum macht daraus eine Zusage, die die Datenbank
-- durchsetzt — und der generierte Client kennt sie.
--
-- Von Hand geschrieben, weil Prisma für String → Enum ein DROP COLUMN + ADD
-- COLUMN erzeugt. Das würde bestehende Werte wegwerfen; der Cast unten behält
-- sie.

CREATE TYPE "ProjectVisibility" AS ENUM ('public', 'private');

ALTER TABLE "Project" ALTER COLUMN "visibility" DROP DEFAULT;

ALTER TABLE "Project"
  ALTER COLUMN "visibility" TYPE "ProjectVisibility"
  USING "visibility"::"ProjectVisibility";

ALTER TABLE "Project" ALTER COLUMN "visibility" SET DEFAULT 'public';

-- ─── 2. Einladungen ───────────────────────────────────────────────────────────
--
-- Der Weg von „Konto ohne Passwort, Mitgliedschaft pending" zum fertigen Zugang.
-- Bisher gab es ihn nicht: `pending` wurde gesetzt und nie wieder gelöscht, und
-- ein eingeladenes Konto konnte sich nicht anmelden.

CREATE TABLE "Invitation" (
  "token"       TEXT         NOT NULL,
  "workspaceId" TEXT         NOT NULL,
  "userId"      TEXT         NOT NULL,
  "projectId"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires"     TIMESTAMP(3) NOT NULL,
  "acceptedAt"  TIMESTAMP(3),

  CONSTRAINT "Invitation_pkey" PRIMARY KEY ("token")
);

CREATE INDEX "Invitation_userId_workspaceId_idx" ON "Invitation"("userId", "workspaceId");
CREATE INDEX "Invitation_workspaceId_idx" ON "Invitation"("workspaceId");

ALTER TABLE "Invitation"
  ADD CONSTRAINT "Invitation_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invitation"
  ADD CONSTRAINT "Invitation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Verschwindet das einladende Projekt, bleibt die Einladung gültig — sie führt
-- dann nur nicht mehr dorthin.
ALTER TABLE "Invitation"
  ADD CONSTRAINT "Invitation_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
