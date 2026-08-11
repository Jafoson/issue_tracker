-- CreateTable
CREATE TABLE "UserPreferences" (
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "density" TEXT NOT NULL DEFAULT 'airy',
    "assignedInApp" BOOLEAN NOT NULL DEFAULT true,
    "assignedEmail" BOOLEAN NOT NULL DEFAULT true,
    "mentionedInApp" BOOLEAN NOT NULL DEFAULT true,
    "mentionedEmail" BOOLEAN NOT NULL DEFAULT true,
    "commentInApp" BOOLEAN NOT NULL DEFAULT true,
    "commentEmail" BOOLEAN NOT NULL DEFAULT false,
    "statusInApp" BOOLEAN NOT NULL DEFAULT true,
    "statusEmail" BOOLEAN NOT NULL DEFAULT false,
    "inviteInApp" BOOLEAN NOT NULL DEFAULT true,
    "inviteEmail" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
