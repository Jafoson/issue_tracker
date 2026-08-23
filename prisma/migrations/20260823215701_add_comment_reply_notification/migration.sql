-- AlterTable
ALTER TABLE "UserPreferences" ADD COLUMN     "commentReplyEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "commentReplyInApp" BOOLEAN NOT NULL DEFAULT true;
