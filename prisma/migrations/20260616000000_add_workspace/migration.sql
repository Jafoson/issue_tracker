-- CreateTable Workspace
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable WorkspaceMember
CREATE TABLE "WorkspaceMember" (
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "pending" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("workspaceId","userId")
);

-- Seed the default workspace
INSERT INTO "Workspace" ("id", "name") VALUES ('nimbus', 'Nimbus');

-- Migrate existing User.role + User.pending into WorkspaceMember
INSERT INTO "WorkspaceMember" ("workspaceId", "userId", "role", "pending")
SELECT 'nimbus', "id", "role", "pending" FROM "User";

-- AddColumn workspaceId (with temporary DEFAULT to backfill existing rows)
ALTER TABLE "IssueType" ADD COLUMN "workspaceId" TEXT NOT NULL DEFAULT 'nimbus';
ALTER TABLE "Label"     ADD COLUMN "workspaceId" TEXT NOT NULL DEFAULT 'nimbus';
ALTER TABLE "Priority"  ADD COLUMN "workspaceId" TEXT NOT NULL DEFAULT 'nimbus';
ALTER TABLE "Project"   ADD COLUMN "workspaceId" TEXT NOT NULL DEFAULT 'nimbus';
ALTER TABLE "Role"      ADD COLUMN "workspaceId" TEXT NOT NULL DEFAULT 'nimbus';
ALTER TABLE "Status"    ADD COLUMN "workspaceId" TEXT NOT NULL DEFAULT 'nimbus';
ALTER TABLE "Team"      ADD COLUMN "workspaceId" TEXT NOT NULL DEFAULT 'nimbus';

-- Drop the temporary defaults
ALTER TABLE "IssueType" ALTER COLUMN "workspaceId" DROP DEFAULT;
ALTER TABLE "Label"     ALTER COLUMN "workspaceId" DROP DEFAULT;
ALTER TABLE "Priority"  ALTER COLUMN "workspaceId" DROP DEFAULT;
ALTER TABLE "Project"   ALTER COLUMN "workspaceId" DROP DEFAULT;
ALTER TABLE "Role"      ALTER COLUMN "workspaceId" DROP DEFAULT;
ALTER TABLE "Status"    ALTER COLUMN "workspaceId" DROP DEFAULT;
ALTER TABLE "Team"      ALTER COLUMN "workspaceId" DROP DEFAULT;

-- Drop old unique constraints that changed scope
DROP INDEX IF EXISTS "Project_prefix_key";
DROP INDEX IF EXISTS "Team_key_key";
DROP INDEX IF EXISTS "Priority_key_key";

-- Drop old User columns
ALTER TABLE "User" DROP COLUMN "pending";
ALTER TABLE "User" DROP COLUMN "role";

-- AddForeignKey WorkspaceMember → Workspace
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey WorkspaceMember → User
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey workspaceId columns → Workspace
ALTER TABLE "IssueType" ADD CONSTRAINT "IssueType_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Label"     ADD CONSTRAINT "Label_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Priority"  ADD CONSTRAINT "Priority_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project"   ADD CONSTRAINT "Project_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Role"      ADD CONSTRAINT "Role_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Status"    ADD CONSTRAINT "Status_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Team"      ADD CONSTRAINT "Team_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex (new unique constraints)
CREATE UNIQUE INDEX "Project_workspaceId_prefix_key" ON "Project"("workspaceId", "prefix");
CREATE UNIQUE INDEX "Priority_workspaceId_key_key"   ON "Priority"("workspaceId", "key");
CREATE UNIQUE INDEX "Role_workspaceId_id_key"         ON "Role"("workspaceId", "id");
CREATE UNIQUE INDEX "Team_workspaceId_key_key"        ON "Team"("workspaceId", "key");

-- CreateIndex (performance indexes)
CREATE INDEX "IssueType_workspaceId_position_idx" ON "IssueType"("workspaceId", "position");
CREATE INDEX "Label_workspaceId_idx"              ON "Label"("workspaceId");
CREATE INDEX "Priority_workspaceId_position_idx"  ON "Priority"("workspaceId", "position");
CREATE INDEX "Status_workspaceId_position_idx"    ON "Status"("workspaceId", "position");
