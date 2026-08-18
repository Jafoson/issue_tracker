-- AlterTable
ALTER TABLE "UserPreferences" ADD COLUMN     "issueSharedEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "issueSharedInApp" BOOLEAN NOT NULL DEFAULT true;
