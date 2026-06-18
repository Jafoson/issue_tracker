-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "lastIssueKey" INTEGER NOT NULL DEFAULT 0;

-- Reset issue numbering: clear existing issues so new keys start at 1.
DELETE FROM "Comment" WHERE "issueId" IN (SELECT "id" FROM "Issue");
DELETE FROM "Issue";
