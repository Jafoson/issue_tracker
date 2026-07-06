-- Replace the boolean `isPlatformAdmin` flag with a global role string
-- ("admin" | "member"). Add the new column first, backfill existing platform
-- admins to the "admin" role, then drop the old flag.
ALTER TABLE "User" ADD COLUMN "globalRole" TEXT NOT NULL DEFAULT 'member';

UPDATE "User" SET "globalRole" = 'admin' WHERE "isPlatformAdmin" = true;

ALTER TABLE "User" DROP COLUMN "isPlatformAdmin";
