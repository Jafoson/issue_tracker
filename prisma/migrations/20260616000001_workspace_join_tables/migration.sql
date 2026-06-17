-- CreateTable WorkspaceStatus
CREATE TABLE "WorkspaceStatus" (
    "workspaceId" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    CONSTRAINT "WorkspaceStatus_pkey" PRIMARY KEY ("workspaceId","statusId")
);

-- CreateTable WorkspacePriority
CREATE TABLE "WorkspacePriority" (
    "workspaceId" TEXT NOT NULL,
    "priorityId" INTEGER NOT NULL,
    CONSTRAINT "WorkspacePriority_pkey" PRIMARY KEY ("workspaceId","priorityId")
);

-- CreateTable WorkspaceIssueType
CREATE TABLE "WorkspaceIssueType" (
    "workspaceId" TEXT NOT NULL,
    "issueTypeId" TEXT NOT NULL,
    CONSTRAINT "WorkspaceIssueType_pkey" PRIMARY KEY ("workspaceId","issueTypeId")
);

-- CreateTable WorkspaceRole
CREATE TABLE "WorkspaceRole" (
    "workspaceId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    CONSTRAINT "WorkspaceRole_pkey" PRIMARY KEY ("workspaceId","roleId")
);

-- Migrate existing data from direct workspaceId columns into join tables
INSERT INTO "WorkspaceStatus"   ("workspaceId", "statusId")    SELECT "workspaceId", "id" FROM "Status";
INSERT INTO "WorkspacePriority" ("workspaceId", "priorityId")  SELECT "workspaceId", "id" FROM "Priority";
INSERT INTO "WorkspaceIssueType"("workspaceId", "issueTypeId") SELECT "workspaceId", "id" FROM "IssueType";
INSERT INTO "WorkspaceRole"     ("workspaceId", "roleId")      SELECT "workspaceId", "id" FROM "Role";

-- Drop indexes that reference the old workspaceId columns
DROP INDEX IF EXISTS "Status_workspaceId_position_idx";
DROP INDEX IF EXISTS "Priority_workspaceId_key_key";
DROP INDEX IF EXISTS "Priority_workspaceId_position_idx";
DROP INDEX IF EXISTS "IssueType_workspaceId_position_idx";
DROP INDEX IF EXISTS "Role_workspaceId_id_key";

-- Drop FK constraints on old workspaceId columns
ALTER TABLE "Status"    DROP CONSTRAINT IF EXISTS "Status_workspaceId_fkey";
ALTER TABLE "Priority"  DROP CONSTRAINT IF EXISTS "Priority_workspaceId_fkey";
ALTER TABLE "IssueType" DROP CONSTRAINT IF EXISTS "IssueType_workspaceId_fkey";
ALTER TABLE "Role"      DROP CONSTRAINT IF EXISTS "Role_workspaceId_fkey";

-- Drop workspaceId columns from models now using join tables
ALTER TABLE "Status"    DROP COLUMN "workspaceId";
ALTER TABLE "Priority"  DROP COLUMN "workspaceId";
ALTER TABLE "IssueType" DROP COLUMN "workspaceId";
ALTER TABLE "Role"      DROP COLUMN "workspaceId";

-- Restore Priority.key unique constraint (was dropped in migration 4 for workspaceId scope)
CREATE UNIQUE INDEX "Priority_key_key" ON "Priority"("key");

-- AddForeignKey WorkspaceStatus
ALTER TABLE "WorkspaceStatus" ADD CONSTRAINT "WorkspaceStatus_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceStatus" ADD CONSTRAINT "WorkspaceStatus_statusId_fkey"
    FOREIGN KEY ("statusId") REFERENCES "Status"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey WorkspacePriority
ALTER TABLE "WorkspacePriority" ADD CONSTRAINT "WorkspacePriority_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspacePriority" ADD CONSTRAINT "WorkspacePriority_priorityId_fkey"
    FOREIGN KEY ("priorityId") REFERENCES "Priority"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey WorkspaceIssueType
ALTER TABLE "WorkspaceIssueType" ADD CONSTRAINT "WorkspaceIssueType_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceIssueType" ADD CONSTRAINT "WorkspaceIssueType_issueTypeId_fkey"
    FOREIGN KEY ("issueTypeId") REFERENCES "IssueType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey WorkspaceRole
ALTER TABLE "WorkspaceRole" ADD CONSTRAINT "WorkspaceRole_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceRole" ADD CONSTRAINT "WorkspaceRole_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
